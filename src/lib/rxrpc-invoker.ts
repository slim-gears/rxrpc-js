import {Observable} from 'rxjs';

export abstract class RxRpcInvoker {
    public abstract invoke<T>(method: string, args: any): Observable<T>;
    public abstract invokeShared<T>(method: string, replayCount: number, args: any): Observable<T>;
    public abstract observeConnected(): Observable<boolean>;
}
