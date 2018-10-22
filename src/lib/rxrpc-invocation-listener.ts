import {Invocation} from './data/invocation';
import {Response} from './data/response';

export interface RxRpcInvocationListenerSubscription {
    unsubscribe();
}

export interface RxRpcInvocationListener {
    onInvocation(invocation: Invocation)
    onResponse(response: Response);
}
