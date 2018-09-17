import {defer, interval, Observable, of, Subject, throwError} from 'rxjs';
import {flatMap, takeUntil, takeWhile} from 'rxjs/operators'
import {Response} from './data/response';
import {Result} from './data/result';
import {Invocation, Invocations} from './data/invocation';
import {ResultType} from './data/result-type';
import {RxRpcTransport} from './rxrpc-transport';
import {Injectable, Optional} from '@angular/core';
import {addTearDown} from './rxrpc-operators';
import {RxRpcInvoker} from './rxrpc-invoker';

export abstract class RxRpcClientOptions {
    keepAlivePeriodMillis?: number
}

@Injectable()
export class RxRpcClient extends RxRpcInvoker {
    private static defaultOptions: RxRpcClientOptions = {
        keepAlivePeriodMillis: 60000
    };

    private invocationId: number = 0;
    private readonly options: RxRpcClientOptions;
    private readonly invocations = new Map<number, Subject<Result>>();
    private readonly cancelledSubject = new Subject();

    constructor(private readonly transport: RxRpcTransport, @Optional() options?: RxRpcClientOptions) {
        super();
        this.options = {...RxRpcClient.defaultOptions, ...options};
        this.transport.messages
            .pipe(takeUntil(this.cancelledSubject))
            .subscribe(this.dispatchResponse.bind(this));
        interval(this.options.keepAlivePeriodMillis)
            .pipe(takeUntil(this.cancelledSubject))
            .subscribe(() => this.sendKeepAlive());
    }

    public invoke<T>(method: string, args: any): Observable<T> {
        return defer(() => {
            const invocation: Invocation = Invocations.subscription(++this.invocationId, method, args);
            const subject = new Subject<Result>();
            this.invocations.set(invocation.invocationId, subject);
            this.transport.send(invocation);

            return subject.pipe(
                takeWhile(res => res.type != ResultType.Complete),
                flatMap(res => {
                    console.log(res);
                    return (res.type === ResultType.Data) ? of(<T>res.data) : throwError(res.error);
                }),
                addTearDown(() => this.unsubscribe(invocation.invocationId)));
        })
    }

    public close() {
        this.cancelledSubject.next();
        this.transport.close();
    }

    private unsubscribe(invocationId: number) {
        this.transport.send(Invocations.unsubscription(invocationId));
    }

    private sendKeepAlive() {
        this.transport.send(Invocations.keepAlive());
    }

    private dispatchResponse(response: Response) {
        this.invocations
            .get(response.invocationId)
            .next(response.result);
    }
}
