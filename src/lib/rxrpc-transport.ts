import {Observable} from 'rxjs';

export interface RxRpcConnection {
    readonly messages: Observable<any>;
    send(msg: any);
    close();
}

export abstract class RxRpcTransport {
    abstract connect(): Observable<RxRpcConnection>;
}
