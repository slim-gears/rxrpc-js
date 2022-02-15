import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {defer, Observable, Observer, of, Subject, Subscription, throwError} from 'rxjs';
import {delay, filter, finalize, map, mergeMap, repeat, retry, takeWhile, tap} from "rxjs/operators";
import {HttpAttributes} from "./rxrpc-http-attributes";
import {fromPromise} from "rxjs/internal-compatibility";
import {fromArray} from "rxjs/internal/observable/fromArray";
import * as log from "loglevel"
import {flatMap} from "rxjs/internal/operators";
import {fromJson, utf8ArrayToStr} from "./utils";

export interface RxRpcHttpTransportOptions {
    idlePollingPeriodMillis?: number
    activePollingPeriodMillis?: number
    pollingRetryCount?: number
    observeEnabled?: boolean
    interceptors?: RxRpcHttpTransportInterceptor[]
}

export interface RxRpcHttpTransportRequestConfig {
    headers: {[key: string]: string}
}

export interface RxRpcHttpTransportInterceptor {
    intercept(requestConfig: RxRpcHttpTransportRequestConfig) : Observable<RxRpcHttpTransportRequestConfig>;
}

enum HttpStatus {
    OK = 200,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401
}

export class RxRpcHttpConnection implements RxRpcConnection {
    readonly interceptors: RxRpcHttpTransportInterceptor[] = [];
    readonly messages: Observable<any>;
    private pollingSubscription: Subscription = Subscription.EMPTY;
    private readonly incoming = new Subject<any>();
    private nextPollTime: number = null;
    private pollIntervalMillis: number;
    private longPollInProgress: boolean;

    constructor(private readonly uri: string,
                private readonly clientId: string,
                private options: RxRpcHttpTransportOptions) {

        log.debug('Connection established. ClientID: ', clientId)
        this.interceptors = options.interceptors || [];
        this.interceptors.push({
            intercept(requestConfig: RxRpcHttpTransportRequestConfig): Observable<RxRpcHttpTransportRequestConfig> {
                requestConfig.headers[HttpAttributes.ClientIdAttribute] = clientId;
                return of(requestConfig);
            }
        });

        if (this.options.observeEnabled) {
            this.pollingSubscription = defer(() => {
                this.longPollInProgress = true;
                return this.observe()
            }).pipe(finalize(() => this.longPollInProgress = false))
                .subscribe(
                    obj => this.incoming.next(obj),
                    err => this.incoming.error(err),
                    () => this.incoming.complete())
        }
        this.pollIntervalMillis = this.options.idlePollingPeriodMillis;
        this.messages = this.incoming;
    }

    close() {
        this.pollingSubscription.unsubscribe();
        RxRpcHttpConnection.postWithInterceptors(`${this.uri}/disconnect`, RxRpcHttpConnection.requestConfig(this.interceptors)).subscribe();
    }

    error(error: any) {
        this.close();
    }

    send(msg: any) {
        this.onActive();
        this.post('message', msg).subscribe();
    }

    poll(): Observable<any> {
        log.debug('Beginning poll')
        return this.post('polling');
    }

    private observe(): Observable<any> {
        return new Observable<string>(observer => fromPromise(this.observeAsync(observer)).subscribe())
            .pipe(fromJson())
    }

    private async observeAsync(observer: Observer<string>) {
        this.longPollInProgress = true
        const request = await RxRpcHttpConnection.requestConfig(this.interceptors).toPromise()

        while (!observer.closed) {
            log.debug('Beginning observe. Request info: ', request)
            const response = await fetch(`${this.uri}/observe`, {headers: request.headers})
            if (response.status == HttpStatus.OK) {
                const reader = response.body.getReader()
                while (!observer.closed) {
                    log.debug('Beginning wait for message')
                    const result = await reader.read()
                    log.debug(`Received result (done: ${result.done})`)
                    if (!result.done) {
                        const msg = utf8ArrayToStr(result.value)
                        log.debug('Received message: ', msg)
                        observer.next(msg)
                    } else {
                        break;
                    }
                }
                log.debug('Observe finished')
            } else {
                log.debug(`Status: ${response.status} (${response.statusText})`)
                observer.error(response.status)
                return;
            }
        }

        observer.complete()
    }

    private onIdle() {
        // increase polling interval when idle
        this.setPollingInterval(this.pollIntervalMillis + this.options.activePollingPeriodMillis)
    }

    private setPollingInterval(intervalMillis: number) {
        this.pollIntervalMillis = Math.min(intervalMillis, this.options.idlePollingPeriodMillis)
        log.debug('Interval set to:', intervalMillis)
    }

    private onActive() {
        this.schedulePoll(this.options.activePollingPeriodMillis)
    }

    private schedulePoll(intervalMillis: number) {
        this.setPollingInterval(intervalMillis);
        if (this.longPollInProgress) {
            return;
        }
        log.debug(`Requested poll in ${intervalMillis} millis`)
        const requestedPollTime = Date.now() + intervalMillis;
        if (!this.nextPollTime || requestedPollTime < this.nextPollTime) {
            this.pollingSubscription.unsubscribe()
            this.nextPollTime = requestedPollTime
            log.debug(`Scheduling next poll for: ${new Date(requestedPollTime)}`)
            this.pollingSubscription = defer(() => {
                this.nextPollTime = null
                return this.poll()
            }).pipe(
                delay(intervalMillis),
                retry(this.options.pollingRetryCount))
                .subscribe(() => {}, () => {}, () => this.schedulePoll(this.pollIntervalMillis))
        }
    }

    static postWithInterceptors(url: string, request: Observable<RxRpcHttpTransportRequestConfig>, body?: any): Observable<Response> {
        return fromPromise(RxRpcHttpConnection.postWithInterceptorsPromise(url, request.toPromise(), JSON.stringify(body)));
    }

    static async postWithInterceptorsPromise(url: string, request: Promise<RxRpcHttpTransportRequestConfig>, body?: any): Promise<Response> {
        const cfg = await request;
        return fetch(url, {method: 'POST', body: body, headers: cfg.headers})
    }

    static requestConfig(interceptors: RxRpcHttpTransportInterceptor[]): Observable<RxRpcHttpTransportRequestConfig> {
        const headers = {};

        let config: Observable<RxRpcHttpTransportRequestConfig> = of({headers: headers});

        // flatten all interceptor observable
        interceptors.forEach(interceptor => config = config.pipe(mergeMap(cfg => interceptor.intercept(cfg))));

        return config;
    }

    post(path: string, msg?: any): Observable<any> {
        return RxRpcHttpConnection.postWithInterceptors(`${this.uri}/${path}`, RxRpcHttpConnection.requestConfig(this.interceptors), msg)
            .pipe(
                flatMap(resp => {
                    if (resp.status != HttpStatus.OK) {
                        throwError(resp.statusText);
                    }
                    return fromPromise(resp.text())
                }),
                filter(t => !!t),
                tap(t => log.debug("Received message: ", t)),
                map(t => JSON.parse(t)),
                mergeMap(data => {
                    if (!data || data.constructor != Array || !data.length) {
                        this.onIdle();
                    }
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
        ...HttpAttributes.DefaultOptions,
        interceptors: []
    }

    constructor(private readonly uri: string, options?: RxRpcHttpTransportOptions) {
        this.options = {...RxRpcHttpTransport.defaultOptions, ...options} || RxRpcHttpTransport.defaultOptions
    }

    connect(): Observable<RxRpcHttpConnection> {
        return RxRpcHttpConnection.postWithInterceptors(`${this.uri}/connect`, RxRpcHttpConnection.requestConfig(this.options.interceptors))
            .pipe(flatMap( res => {
                if (res.status != HttpStatus.OK) {
                    throwError(res.statusText)
                }
                log.debug('Connection response received', typeof(res), res)
                const clientId = res.headers.get(HttpAttributes.ClientIdAttribute.toLocaleLowerCase());
                return of(new RxRpcHttpConnection(this.uri, clientId, this.options));
            }));
    }

}
