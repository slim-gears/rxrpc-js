import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {defer, MonoTypeOperatorFunction, Observable, Subject, Subscriber} from 'rxjs';
import {delay, retryWhen, takeUntil} from 'rxjs/operators';

export class RxRpcReconnectableTransport extends RxRpcTransport {
    constructor(private transport: RxRpcTransport) {
        super();
    }

    connect(): Observable<RxRpcConnection> {
        return defer(() => this.transport.connect())
            .pipe(
                RxRpcReconnectableTransport.passThroughMessageErrors(),
                retryWhen(errors => errors
                    .pipe(delay(1000))));
    }

    public static of(transport: RxRpcTransport): RxRpcTransport {
        return new RxRpcReconnectableTransport(transport);
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