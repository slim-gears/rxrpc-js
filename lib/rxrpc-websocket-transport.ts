import { RxRpcTransport } from "./rxrpc-transport";
import { WebSocketSubject, webSocket } from 'rxjs/webSocket'
import {Observable} from 'rxjs';

export class RxRpcWebSocketTransport extends RxRpcTransport {
    private webSocket: WebSocketSubject<any>;

    get messages(): Observable<any> {
        return this.webSocket;
    }

    constructor(url: string) {
        super();
        this.webSocket = webSocket(url);
    }

    send(msg: any) {
        this.webSocket.next(msg);
    }
}
