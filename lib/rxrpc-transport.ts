import { Observable } from "rxjs";

export abstract class RxRpcTransport {
    readonly messages: Observable<string>;
    abstract send(msg: string);
}
