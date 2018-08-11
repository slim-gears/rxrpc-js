import { Observable } from "rxjs";

export interface RxRpcTransport {
    readonly messages: Observable<string>;
    send(msg: string);
}
