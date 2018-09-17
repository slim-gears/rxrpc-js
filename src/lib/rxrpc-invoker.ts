import {Observable} from 'rxjs';

export abstract class RxRpcInvoker {
    public abstract invoke<T>(method: string, args: any): Observable<T>;
}
