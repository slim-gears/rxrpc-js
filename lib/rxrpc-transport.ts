import { Observable } from "rxjs";

export abstract class RxRpcTransport {
    readonly messages: Observable<any>;
    abstract send(msg: any);
}
