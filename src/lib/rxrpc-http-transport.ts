import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {interval, Observable, of, Subject, Subscription} from 'rxjs';
import {map, mergeMap, retry, tap} from "rxjs/operators";
import {HttpAttributes} from "./rxrpc-http-attributes";
import axios from 'axios';
import {fromPromise} from "rxjs/internal-compatibility";
import {fromArray} from "rxjs/internal/observable/fromArray";

export interface RxRpcHttpTransportOptions {
    pollingPeriodMillis?: number
    pollingRetryCount?: number
    interceptors?: RxRpcHttpTransportInterceptor[]
}

export interface RxRpcHttpTransportRequestConfig {
    headers: {[key: string]: string}
}

export interface RxRpcHttpTransportInterceptor {
    intercept(requestConfig: RxRpcHttpTransportRequestConfig) : Observable<RxRpcHttpTransportRequestConfig>;
}

export class RxRpcHttpConnection implements RxRpcConnection {
    readonly interceptors: RxRpcHttpTransportInterceptor[] = [];
    readonly messages: Observable<any>;
    private pollingSubscription: Subscription;
    private readonly incoming = new Subject<any>();

    constructor(private readonly uri: string,
                private readonly clientId: string,
                options: RxRpcHttpTransportOptions) {

        this.interceptors = options.interceptors || [];
        this.interceptors.push({
                intercept(requestConfig: RxRpcHttpTransportRequestConfig): Observable<RxRpcHttpTransportRequestConfig> {
                    requestConfig.headers[HttpAttributes.ClientIdAttribute] = clientId;
                    return of(requestConfig);
                }
        });

        this.messages = this.incoming;
        this.pollingSubscription = interval(options.pollingPeriodMillis)
            .pipe(
                mergeMap(() => this.poll()),
                retry(options.pollingRetryCount))
            .subscribe(
                () => {},
                () => {},
                () => this.incoming.complete());
    }

    close() {
        this.pollingSubscription.unsubscribe();
        RxRpcHttpConnection.postWithInterceptors(`${this.uri}/disconnect`, this.interceptors).subscribe();
    }

    error(error: any) {
        this.close();
    }

    send(msg: any) {
        this.post('message', msg).subscribe();
    }

    poll(): Observable<any> {
        return this.post('polling');
    }

    static postWithInterceptors(url: string, interceptors: RxRpcHttpTransportInterceptor[], body?: any): Observable<any> {
        const headers = {};

        let config: Observable<RxRpcHttpTransportRequestConfig> = of({headers: headers});

        // flatten all interceptor observable
        interceptors.forEach(interceptor => config = config.pipe(mergeMap(cfg => interceptor.intercept(cfg))));

        return config.pipe(mergeMap(cfg =>
            fromPromise(axios.post<string>(url, body, {headers: cfg.headers}))));
    }

    post(path: string, msg?: any): Observable<any> {
        return RxRpcHttpConnection.postWithInterceptors(`${this.uri}/${path}`, this.interceptors, msg)
            .pipe(
                map(resp => resp.data),
                mergeMap(data => {
                    return fromArray(data);
                }),
                tap(
                obj => this.incoming.next(obj),
                err => this.incoming.error(err)
                )
            )
    }
}

export class RxRpcHttpTransport implements RxRpcTransport {
    private readonly options: RxRpcHttpTransportOptions;
    private static readonly defaultOptions: RxRpcHttpTransportOptions = {
        pollingPeriodMillis: HttpAttributes.DefaultClientPollingPeriodMillis,
        pollingRetryCount: HttpAttributes.DefaultClientPollingRetryCount,
        interceptors: []
    }

    constructor(private readonly uri: string, options?: RxRpcHttpTransportOptions) {
        this.options = {...RxRpcHttpTransport.defaultOptions, ...options} || RxRpcHttpTransport.defaultOptions
    }

    connect(): Observable<RxRpcHttpConnection> {
        return RxRpcHttpConnection.postWithInterceptors(`${this.uri}/connect`, this.options.interceptors)
            .pipe(map( res => {
                const clientId = res.headers[HttpAttributes.ClientIdAttribute.toLowerCase()];
                return new RxRpcHttpConnection(this.uri, clientId, this.options);
            }));
    }
}
