import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {webSocket} from 'rxjs/webSocket'
import {Observable} from 'rxjs';

export class RxRpcWebSocketTransport extends RxRpcTransport {
    constructor(private readonly url: string) {
        super();
    }

    connect(): Observable<RxRpcConnection> {
        return Observable.create(observer => {
            const ws = webSocket(this.url);
            observer.next({
                messages: ws,
                send: msg => ws.next(msg),
                close: () => ws.complete()
            })
        });
    }
}
