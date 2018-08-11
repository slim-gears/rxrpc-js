import { RxRpcTransport } from "./rxrpc-transport";
import { WebSocketSubject, webSocket } from 'rxjs/webSocket'

export class RxRpcWebSocketTransport implements RxRpcTransport {
    private webSocket: WebSocketSubject<string>;

    get messages() {
        return this.webSocket;
    }

    constructor(url: string) {
        this.webSocket = webSocket(url);
    }

    send(msg: string) {
        this.webSocket.next(msg);
    }
}
