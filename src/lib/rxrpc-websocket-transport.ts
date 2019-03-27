import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {webSocket, WebSocketSubjectConfig} from 'rxjs/webSocket'
import {Observable, of} from 'rxjs';
import {map, take} from 'rxjs/operators';

export class RxRpcWebSocketTransport implements RxRpcTransport {
    private readonly config: WebSocketSubjectConfig<any>;

    constructor(urlOrConfig: string|WebSocketSubjectConfig<any>) {
        this.config = typeof urlOrConfig === 'string'
            ? {url: urlOrConfig}
            : <WebSocketSubjectConfig<any>>urlOrConfig;
    }

    connect(): Observable<RxRpcConnection> {
        return this.getConfig().pipe(
            take(1),
            map(config => {

                const ws = webSocket(config);

                return <RxRpcConnection>{
                    messages: ws,
                    send: msg => ws.next(msg),
                    close: () => ws.complete(),
                    error: error => ws.error(error)
                }
            }));
    }

    protected getConfig(): Observable<WebSocketSubjectConfig<any>> {
        return of({...this.config});
    }
}
