import {Invocation} from './data/invocation';
import {Result} from './data/result';

export interface RxRpcInvocationListenerSubscription {
    unsubscribe();
}

export interface RxRpcInvocationListener {
    onInvocation(invocation: Invocation)
    onResponse(response: Result);
}
