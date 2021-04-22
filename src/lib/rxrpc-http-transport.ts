import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {interval, Observable, of, Subject, Subscription} from 'rxjs';
import {mergeMap, map, retry, filter} from "rxjs/operators";
import {HttpAttributes} from "./rxrpc-http-attributes";
import axios, {AxiosResponse} from 'axios';
import {fromPromise} from "rxjs/internal-compatibility";
import {fromArray} from "rxjs/internal/observable/fromArray";


export class RxRpcHttpConnection implements RxRpcConnection {
    readonly messages: Observable<any>;
    private pollingSubscription: Subscription;
    private readonly incoming = new Subject<any>();

    constructor(private readonly uri: string, private readonly clientId: string) {
        this.messages = this.incoming;
        this.pollingSubscription = interval(HttpAttributes.ClientPollingPeriod)
            .pipe(
                mergeMap(() => this.poll()),
                retry(HttpAttributes.ClientPollingRetryCount))
            .subscribe(
                obj => this.incoming.next(obj),
                err => this.incoming.error(err),
                () => this.incoming.complete());
    }

    close() {
        this.pollingSubscription.unsubscribe();
    }

    error(error: any) {
        this.close();
    }

    send(msg: any) {
        this.post('message', msg).subscribe();
    }

    poll(): Observable<any> {
        return this.post('polling')
            .pipe(
                map(resp => resp.data),
                filter(data => data !== ""),
                mergeMap(data => {
                    if(typeof data === 'string') {
                        return fromArray(data.split("\n").filter(s => s).map(s => JSON.parse(s)));
                    }
                    return of(data);
                }));
    }

    post(path: string, msg?: any): Observable<AxiosResponse<string>> {
        const headers = {};
        headers[HttpAttributes.ClientIdAttribute] = this.clientId;
        return fromPromise(axios.post<string>(`${this.uri}/${path}`, msg, {headers: headers}))
    }
}

export class RxRpcHttpTransport implements RxRpcTransport {

    constructor(private readonly uri: string) {}

    connect(): Observable<RxRpcHttpConnection> {
        return fromPromise(axios.post<string>(`${this.uri}/connect`))
            .pipe(
                map( res => {
                    const clientId = res.headers[HttpAttributes.ClientIdAttribute.toLowerCase()];
                    return new RxRpcHttpConnection(this.uri, clientId);
                }));
    }
}
