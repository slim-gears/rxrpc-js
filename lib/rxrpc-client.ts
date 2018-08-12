import { Observable, Subject, of, throwError } from 'rxjs';
import { map, takeUntil, takeWhile, flatMap } from 'rxjs/operators'
import { Response } from './data/response';
import { Result } from './data/result';
import { Invocation } from './data/invocation';
import { ResultType } from './data/result-type';
import { RxRpcTransport } from './rxrpc-transport';
import { Injectable } from '@angular/core';

@Injectable()
export class RxRpcClient {
    private invocationId: number = 0;
    private readonly invocations = new Map<number, Subject<Result>>();
    private readonly cancelledSubject = new Subject<boolean>();

    constructor(private readonly transport: RxRpcTransport) {
        this.transport.messages
            .pipe(
                map(str => <Response>JSON.parse(str)),
                takeUntil(this.cancelledSubject))
            .subscribe(this.dispatchResponse.bind(this));
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
                this.transport.send(JSON.stringify({
                    invocationId: invocation.invocationId
                }));
            });
        }

        this.invocations.set(invocation.invocationId, subject);
        this.transport.send(JSON.stringify(invocation));

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
