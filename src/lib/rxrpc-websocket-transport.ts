import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {webSocket, WebSocketSubjectConfig} from 'rxjs/webSocket'
import {Observable} from 'rxjs';

export class RxRpcWebSocketTransport implements RxRpcTransport {
    private readonly config: WebSocketSubjectConfig<any>;

    constructor(urlOrConfig: string|WebSocketSubjectConfig<any>) {
        this.config = typeof urlOrConfig === 'string'
            ? {url: urlOrConfig}
            : <WebSocketSubjectConfig<any>>urlOrConfig;
    }

    connect(): Observable<RxRpcConnection> {
        return Observable.create(observer => {
            const ws = webSocket(this.getConfig());
            observer.next({
                messages: ws,
                send: msg => ws.next(msg),
                close: () => ws.complete()
            });
            observer.complete();
        });
    }

    protected getConfig(): WebSocketSubjectConfig<any> {
        return {...this.config};
    }
}
