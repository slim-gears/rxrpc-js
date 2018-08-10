import { Injectable } from '@angular/core'
import { WebSocketSubject, webSocket } from 'rxjs/webSocket'
import { Observable, Subject, of, throwError } from 'rxjs';
import { map, takeWhile, flatMap } from 'rxjs/operators'
import { Response } from './data/response';
import { Result } from './data/result';
import { Invocation } from './data/invocation';
import { ResultType } from './data/result-type';

export class RxRpcClient {
    private invocationId: number = 0;
    private websocket: WebSocketSubject<any>;
    private invocations: Map<number, Subject<Result>>

    private constructor(private url: string) {
        this.websocket = webSocket(url);
        this.websocket
            .pipe(map(str => <Response>JSON.parse(str)))
            .subscribe(this.dispatchResponse.bind(this))
    }

    public static connect(url: string): RxRpcClient {
        return new RxRpcClient(url);
    }

    public invoke<T>(method: string, args: any): Observable<T> {
        const invocation: Invocation = {
            invocationId: ++this.invocationId,
            method: method,
            arguments: args
        }
        const subject = new Subject<Result>();
        const subscribeMethod = subject.subscribe.bind(subject);
        subject.subscribe = (...args) => {
            return subscribeMethod(...args).addTearDown(() => {
                this.invocations.delete(invocation.invocationId);
                this.websocket.next(JSON.stringify({
                    invocationId: invocation.invocationId
                }));
            });
        }

        this.invocations.set(invocation.invocationId, subject);
        this.websocket.next(JSON.stringify(invocation));

        return subject.pipe(
            takeWhile(res => res.type != ResultType.Complete),
            flatMap(res => res.type === ResultType.Data ? of(<T>res.data) : throwError(res.error)));
    }

    private dispatchResponse(response: Response) {
        this.invocations
            .get(response.invocationId)
            .next(response.result);
    }
}
