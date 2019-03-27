import {Observable} from 'rxjs';

export interface RxRpcConnection {
    readonly messages: Observable<any>;
    send(msg: any);
    close();
    error(error: any);
}

export abstract class RxRpcTransport {
    abstract connect(): Observable<RxRpcConnection>;
}
