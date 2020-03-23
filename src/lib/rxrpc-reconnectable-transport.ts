import {RxRpcConnection, RxRpcTransport} from "./rxrpc-transport";
import {BehaviorSubject, combineLatest, Observable, of, Subject, throwError} from "rxjs";
import {
    catchError,
    debounceTime,
    delay,
    filter,
    flatMap,
    map,
    retryWhen,
    takeUntil,
    takeWhile,
    tap
} from "rxjs/operators";

export class RxRpcReconnectableTransport extends RxRpcTransport {
    constructor(private transport: RxRpcTransport) {
        super();
    }

    connect(): Observable<RxRpcConnection> {
        return new Observable<RxRpcConnection>(observer => {
            //const unsubscribeSubject = new Subject();
            const connectionSubscription = this.transport.connect().subscribe(
                connection => {
                    console.log("has new connection object: " + JSON.stringify(connection));
                    let wasError = false;
                    connection.messages
                        //.pipe(takeUntil(unsubscribeSubject))
                        .subscribe(() => {}, error => {
                            console.log("got error: " + JSON.stringify(<Event>error));
                            observer.error(error);
                            wasError = true;
                        });

                    if (!wasError) {
                        console.log("next to connection");
                        observer.next(connection);
                    }
                },
                error => {
                    observer.error(error);
                },
                () => {
                    console.log("complete");
                    observer.complete()
                });
            return () => {
                console.log("return");
                //unsubscribeSubject.next();
                connectionSubscription.unsubscribe();
            }
        }).pipe(
        retryWhen(errors => {
            return errors.pipe(
                tap({
                    // clean in new observable
                    next: () => {
                        console.log("retry!");
                    }
                }),
                takeWhile(value => this.isDisconnection(value)),
                delay(1000));
        }));
    }

    // connect(): Observable<RxRpcConnection> {
    //     const socketError = new BehaviorSubject(<Event>{type: ''});
    //     return combineLatest([this.getConnection(socketError), socketError])
    //         .pipe(
    //             tap(x => console.log(new Date() + "got value before debounce")),
    //             debounceTime(5000),
    //             flatMap(connectionWithError => {
    //                 if (connectionWithError[1] != null && connectionWithError[1].type == 'error') {
    //                     console.log(new Date() + "error detected: " + JSON.stringify(connectionWithError[1]));
    //                     return throwError(connectionWithError[1]);
    //                 }
    //                 //TODO: find a way to avoid it when error
    //                 console.log(new Date() + "next to connection");
    //                 return of(connectionWithError[0]);
    //             }),
    //             retryWhen(errors => {
    //                 return errors.pipe(
    //                     tap({
    //                         // clean in new observable
    //                         next: () => {
    //                             socketError.next(<Event>{type: ''});
    //                             console.log(new Date() + "retry!");
    //                         }
    //                     }),
    //                     takeWhile(value => this.isDisconnection(value)),
    //                     delay(1000));
    //             }));
    // }

    // connect(): Observable<RxRpcConnection> {
    //     return this.transport.connect().pipe(tap(connection => {
    //         console.log("got connection: " + JSON.stringify(connection));
    //         connection.messages.subscribe({error: err =>
    //             console.log("got message error: " + JSON.stringify(err);
    //             }
    //         });
    //     }));
    // }

    // private getConnection(socketError: BehaviorSubject<Event>): Observable<RxRpcConnection> {
    //     return this.transport.connect().pipe(tap(connection => {
    //         const message = connection.messages;
    //         console.log("get new connection with new message: " + message);
    //         message.subscribe({
    //             error: err => {
    //                 console.log("message subscription got: " + err);
    //                 socketError.next(err)
    //             }
    //         });
    //     }));
    // }
    //
    // private isDisconnection(error: Event): boolean {
    //     console.log("isDisconnection error: type: " + error.type);
    //     return true;
    // }
}