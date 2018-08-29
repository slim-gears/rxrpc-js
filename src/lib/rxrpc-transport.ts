import {Observable} from 'rxjs';

export abstract class RxRpcTransport {
    abstract readonly messages: Observable<any>;
    abstract send(msg: any);
    abstract close();
}
