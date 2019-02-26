import {defer, interval, Observable, of, Subject, throwError} from 'rxjs';
import {flatMap, takeUntil, takeWhile} from 'rxjs/operators'
import {Response} from './data/response';
import {Result} from './data/result';
import {Invocation, Invocations} from './data/invocation';
import {ResultType} from './data/result-type';
import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {addTearDown} from './rxrpc-operators';
import {RxRpcInvoker} from './rxrpc-invoker';
import {RxRpcInvocationListener, RxRpcInvocationListenerSubscription} from './rxrpc-invocation-listener';

export abstract class RxRpcClientOptions {
    keepAlivePeriodMillis?: number
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

    constructor(private readonly transport: RxRpcTransport, options?: RxRpcClientOptions) {
        super();
        this.options = {...RxRpcClient.defaultOptions, ...options};

        const self = this;
        this.connectionObservable = Observable
            .create(observer => {
                if (self.currentConnection) {
                    observer.next(self.currentConnection);
                    observer.complete();
                } else {
                    this.transport.connect().subscribe(connection => {
                        self.onConnected(connection);
                        observer.next(connection);
                        observer.complete();
                    })
                }
            });
    }

    public addListener(listener: RxRpcInvocationListener): RxRpcInvocationListenerSubscription {
        this.listeners.push(listener);
        return { unsubscribe: () => this.listeners = this.listeners.filter(l => l != listener) };
    }

    public invoke<T>(method: string, args: any): Observable<T> {
        return defer(() => {
            const invocation: Invocation = Invocations.subscription(++this.invocationId, method, args);
            const subject = new Subject<Result>();
            const observable =  subject.pipe(
                takeWhile(res => res.type != ResultType.Complete),
                flatMap(res => {
                    return (res.type === ResultType.Data) ? of(<T>res.data) : throwError(res.error);
                }),
                addTearDown(() => this.unsubscribe(invocation.invocationId)));

            this.invocations.set(invocation.invocationId, subject);
            this.send(invocation);
            return observable;
        })
    }

    public close() {
        if (this.isConnected()) {
            this.currentConnection.close();
            this.onDisconnected();
        }
    }

    private isConnected(): boolean {
        return this.currentConnection && this.currentConnection != null;
    }

    private send(invocation: Invocation) {
        this.connectionObservable.subscribe(connection => {
            this.listeners.forEach(l => l.onInvocation(invocation));
            connection.send(invocation);
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
        this.currentConnection.messages
            .pipe(takeUntil(this.cancelledSubject))
            .subscribe(this.dispatchResponse.bind(this),
                this.onDisconnected.bind(this),
                this.onDisconnected.bind(this));
        interval(this.options.keepAlivePeriodMillis)
            .pipe(takeUntil(this.cancelledSubject))
            .subscribe(() => this.sendKeepAlive());
    }

    private onDisconnected() {
        this.cancelledSubject.next();
        this.currentConnection = null;
    }

    private dispatchResponse(response: Response) {
        this.listeners.forEach(l => l.onResponse(response));
        this.invocations
            .get(response.invocationId)
            .next(response.result);
    }
}
