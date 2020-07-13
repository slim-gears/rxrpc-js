import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {defer, MonoTypeOperatorFunction, Observable, Subject, Subscriber, of} from 'rxjs';
import {delay, retryWhen, switchMap, takeUntil, tap} from 'rxjs/operators';

export class RxRpcReconnectableTransport extends RxRpcTransport {
    private static readonly DEFAULT_MIN_DELAY_MILLIS: number = 1000;
    private static readonly DEFAULT_MAX_DELAY_MILLIS: number = 32000;

    constructor(private transport: RxRpcTransport,
                private minDelayMillis = RxRpcReconnectableTransport.DEFAULT_MIN_DELAY_MILLIS,
                private maxDelayMillis = RxRpcReconnectableTransport.DEFAULT_MAX_DELAY_MILLIS) {
        super();
    }

    connect(): Observable<RxRpcConnection> {
        let delayMillis = this.minDelayMillis;
        return defer(() => this.transport.connect())
            .pipe(
                RxRpcReconnectableTransport.passThroughMessageErrors(),
                retryWhen(errors => errors
                    .pipe(
                        switchMap(e => of(e).pipe(delay(delayMillis))),
                        tap(() => delayMillis = Math.min(this.maxDelayMillis, delayMillis * 2)))),
                tap(() => delayMillis = this.minDelayMillis));
    }

    public static of(transport: RxRpcTransport, minDelayMillis?: number, maxDelayMillis?: number): RxRpcTransport {
        return new RxRpcReconnectableTransport(transport, minDelayMillis, maxDelayMillis);
    }

    private static passThroughMessageErrors(): MonoTypeOperatorFunction<RxRpcConnection> {
        return source => new Observable<RxRpcConnection>(observer => {
            const safeObserver = new Subscriber<RxRpcConnection>(
                next => observer.next(next),
                err => observer.error(err),
                () => observer.complete());
            const unsubscribeSubject = new Subject();
            const connectionSubscription = source.subscribe(
                connection => {
                    connection.messages
                        .pipe(takeUntil(unsubscribeSubject))
                        .subscribe(
                            () => {},
                            error => safeObserver.error(error),
                            () => safeObserver.complete());
                    safeObserver.next(connection);
                },
                error => safeObserver.error(error));
            return () => {
                unsubscribeSubject.next();
                connectionSubscription.unsubscribe();
            }
        });
    }
}