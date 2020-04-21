import {defer, interval, Observable, of, OperatorFunction, Subject, throwError} from 'rxjs';
import {distinctUntilChanged, finalize, flatMap, refCount, share, shareReplay, takeUntil, takeWhile} from 'rxjs/operators'
import {Response} from './data/response';
import {Result} from './data/result';
import {Invocation, Invocations} from './data/invocation';
import {ResultType} from './data/result-type';
import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {RxRpcInvoker} from './rxrpc-invoker';
import {RxRpcInvocationListener, RxRpcInvocationListenerSubscription} from './rxrpc-invocation-listener';

export abstract class RxRpcClientOptions {
    keepAlivePeriodMillis?: number
}

class InternalSubscription {
    method: string;
    args: any;
}

export class RxRpcClient extends RxRpcInvoker {
    private static defaultOptions: RxRpcClientOptions = {
        keepAlivePeriodMillis: 60000
    };

    private invocationId: number = 0;
    private readonly options: RxRpcClientOptions;
    private readonly invocations = new Map<number, Subject<Result>>();
    private readonly cancelledSubject = new Subject();
    private readonly connectionObservable: Observable<RxRpcConnection>;
    private listeners: RxRpcInvocationListener[] = [];
    private currentConnection: RxRpcConnection;
    private readonly sharedInvocations = new Map<string, Observable<Result>>();
    private readonly connectedSubject = new Subject<boolean>();

    constructor(private readonly transport: RxRpcTransport, options?: RxRpcClientOptions) {
        super();
        this.options = {...RxRpcClient.defaultOptions, ...options};

        const self = this;
        this.connectionObservable = new Observable<RxRpcConnection>(observer => {
                if (self.currentConnection) {
                    observer.next(self.currentConnection);
                    observer.complete();
                } else {
                    self.transport.connect()
                        .subscribe(
                            connection => {
                                self.onConnected(connection);
                                observer.next(connection);
                                observer.complete();
                                },
                            error => observer.error(error),
                            () => observer.complete());
                }
            })
            .pipe(share())
    }

    public observeConnected(): Observable<boolean> {
        return this.connectedSubject.pipe(distinctUntilChanged());
    }

    public addListener(listener: RxRpcInvocationListener): RxRpcInvocationListenerSubscription {
        this.listeners.push(listener);
        return { unsubscribe: () => this.listeners = this.listeners.filter(l => l != listener) };
    }

    public invoke<T>(method: string, args: any): Observable<T> {
        return this
            .invokeInternal({method: method, args: args})
            .pipe(RxRpcClient.toObjects<T>());
    }

    public invokeShared<T>(method: string, replayCount: number, args: any): Observable<T> {
        const subscription: InternalSubscription = {method: method, args: args};
        const key = RxRpcClient.sharedInvocationKey(subscription);
        const observable: Observable<Result> = this.sharedInvocations.get(key) || this.addShared(key, replayCount, subscription);
        return observable.pipe(RxRpcClient.toObjects<T>());
    }

    private static toObjects<T>(): OperatorFunction<Result, T> {
        return (source: Observable<Result>) => source.pipe(flatMap(res => {
            return (res.type === ResultType.Data) ? of(<T>res.data) : throwError(res.error);
        }));
    }

    private addShared(key: string, replayCount: number, subscription: InternalSubscription): Observable<Result> {
        const observable = this.invokeInternal(subscription)
            .pipe(
                finalize(() => this.sharedInvocations.delete(key)),
                shareReplay({
                    bufferSize: replayCount,
                    refCount: true
                }));
        this.sharedInvocations.set(key, observable);
        return observable;
    }

    private invokeInternal(subscription: InternalSubscription): Observable<Result> {
        return defer(() => {
            const invocation: Invocation = Invocations.subscription(++this.invocationId, subscription.method, subscription.args);
            const subject = new Subject<Result>();
            const observable =  subject.pipe(
                takeWhile(res => res.type != ResultType.Complete),
                finalize(() => this.unsubscribe(invocation.invocationId)));
            this.invocations.set(invocation.invocationId, subject);
            this.send(invocation);
            return observable;
        });
    }

    private static sharedInvocationKey(subscription: InternalSubscription) {
        return JSON.stringify(subscription);
    }

    public close() {
        if (this.isConnected()) {
            this.currentConnection.close();
            this.onDisconnected();
        }
    }

    private isConnected(): boolean {
        return this.currentConnection && true;
    }

    private send(invocation: Invocation) {
        this.connectionObservable.subscribe(connection => {
            this.listeners.forEach(l => l.onInvocation(invocation));
            connection.send(invocation);
        }, error => {
            this.currentConnection.error(error);
            this.close();
        });
    }

    private unsubscribe(invocationId: number) {
        this.send(Invocations.unsubscription(invocationId));
    }

    private sendKeepAlive() {
        this.send(Invocations.keepAlive());
    }

    private onConnected(connection: RxRpcConnection) {
        this.currentConnection = connection;
        this.connectedSubject.next(true);
        this.currentConnection.messages
            .pipe(takeUntil(this.cancelledSubject))
            .subscribe(
                msg => this.dispatchResponse(msg),
                error => this.onDisconnected(error),
                () => this.onDisconnected());
        interval(this.options.keepAlivePeriodMillis)
            .pipe(takeUntil(this.cancelledSubject))
            .subscribe(() => this.sendKeepAlive());
    }

    private onDisconnected(error: any = null) {
        this.invocations.forEach(invocation => error
            ? invocation.error(error)
            : invocation.complete());
        this.invocations.clear();
        this.cancelledSubject.next();
        this.currentConnection = null;
        this.connectedSubject.next(false);
    }

    private dispatchResponse(response: Response) {
        this.listeners.forEach(l => l.onResponse(response));
        if (this.invocations && this.invocations.has(response.invocationId)) {
            this.invocations
                .get(response.invocationId)
                .next(response.result);
        }
    }
}
