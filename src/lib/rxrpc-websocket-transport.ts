import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {webSocket, WebSocketSubjectConfig} from 'rxjs/webSocket'
import {BehaviorSubject, combineLatest, Observable, of, Subject, Subscription} from 'rxjs';
import {delay, map, retryWhen, take, takeWhile, tap} from 'rxjs/operators';

export class RxRpcWebSocketTransport implements RxRpcTransport {
    private readonly config: WebSocketSubjectConfig<any>;
    private readonly socketError: Subject<Event> = new BehaviorSubject(<Event>{type: ''});
    private wsSubscription: Subscription;

    constructor(urlOrConfig: string | WebSocketSubjectConfig<any>) {
        this.config = typeof urlOrConfig === 'string'
            ? {url: urlOrConfig}
            : <WebSocketSubjectConfig<any>>urlOrConfig;
    }

    connect(): Observable<RxRpcConnection> {
        return combineLatest([this.getConnection(), this.socketError])
            .pipe(
                tap(connectionWithError => {
                    if (connectionWithError[1] != null && connectionWithError[1].type == 'error') {
                        throw(connectionWithError[1])
                    }
                }),
                map((connectionWithError) => {
                    console.log("WS Connected!");
                    return connectionWithError[0]
                }),
                retryWhen(errors => {
                    this.socketError.next(<Event>{type: ''});
                    return errors.pipe(
                        takeWhile(value => this.isDisconnection(value)),
                        delay(1000));
                }));

    }

    // will return a Single<RxRpcConnection> - Observable which will emit only one RxRpcConnection
    private getConnection(): Observable<RxRpcConnection> {
        return this.getConfig().pipe(
            take(1),
            map(config => {
                console.log("Create new websocket");
                const ws = webSocket(config);
                if(this.wsSubscription){
                    console.log("WS: unsubscribe from old subscription");
                    this.wsSubscription.unsubscribe();
                }
                this.socketError.next(<Event>{type: ''});
                this.wsSubscription = ws.subscribe({error: err => {
                        console.log("WS subscription got: " + err);
                        this.socketError.next(err)
                    }});
                const connection: RxRpcConnection = {
                    messages: ws,
                    send: msg => ws.next(msg), // Sends data from client to server - Output
                    close: () => ws.complete(), // Client side initiated close on the connection - Output
                    error: error => ws.error(error) // todo understand what is the use case
                };
                return connection;
            }));
    }

    private isDisconnection(error: Event): boolean {
        console.log("isDisconnection error: type: " + error.type);
        return true;
    }

    protected getConfig(): Observable<WebSocketSubjectConfig<any>> {
        return of({...this.config});
    }
}
