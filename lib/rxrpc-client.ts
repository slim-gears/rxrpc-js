import { Observable, Subject, of, throwError } from 'rxjs';
import { takeUntil, takeWhile, flatMap } from 'rxjs/operators'
import { Response } from './data/response';
import { Result } from './data/result';
import { Invocation } from './data/invocation';
import { ResultType } from './data/result-type';
import { RxRpcTransport } from './rxrpc-transport';
import { Injectable } from '@angular/core';
import { addTearDown } from './rxrpc-operators';

@Injectable()
export class RxRpcClient {
    private invocationId: number = 0;
    private readonly invocations = new Map<number, Subject<Result>>();
    private readonly cancelledSubject = new Subject<boolean>();

    constructor(private readonly transport: RxRpcTransport) {
        this.transport.messages
            .pipe(takeUntil(this.cancelledSubject))
            .subscribe(this.dispatchResponse.bind(this));
    }

    public invoke<T>(method: string, args: any): Observable<T> {
        const invocation: Invocation = {
            invocationId: ++this.invocationId,
            method: method,
            arguments: args
        }
        const subject = new Subject<Result>();

        this.invocations.set(invocation.invocationId, subject);
        this.transport.send(invocation);

        return subject.pipe(
            addTearDown(() => this.unsubscribe(invocation.invocationId)),
            takeWhile(res => res.type != ResultType.Complete),
            flatMap(res => {
              console.log(res);
              return (res.type === ResultType.Data) ? of(<T>res.data) : throwError(res.error);
            }));
    }

    private unsubscribe(invocationId: number) {
        this.transport.send({invocationId: invocationId});
    }

    private dispatchResponse(response: Response) {
        this.invocations
            .get(response.invocationId)
            .next(response.result);
    }
}
