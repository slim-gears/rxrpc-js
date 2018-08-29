import {InvocationType} from './invocation-type';

export interface HasInvocationType {
    type: InvocationType
}

export interface HasInvocationId {
    invocationId: number;
}

export interface Subscription extends HasInvocationType, HasInvocationId {
    type: InvocationType.Subscription;
    method: string;
    arguments: Map<string, any>;
}

export interface Unsubscription extends HasInvocationType, HasInvocationId {
    type: InvocationType.Unsubscription;
}

export interface KeepAlive extends HasInvocationType {
    type: InvocationType.KeepAlive;
}

export type Invocation = Subscription | Unsubscription | KeepAlive

export class Invocations {
    public static subscription(id: number, method: string, args: Map<string, any>): Subscription {
        return { type: InvocationType.Subscription, invocationId: id, method: method, arguments: args };
    }

    public static unsubscription(id: number): Unsubscription {
        return { type: InvocationType.Unsubscription, invocationId: id };
    }

    public static keepAlive(): KeepAlive {
        return {type: InvocationType.KeepAlive}
    }
}

