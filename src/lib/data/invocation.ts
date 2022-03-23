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

export interface Aggregation extends HasInvocationId {
    type: InvocationType.Aggregation;
    invocations: Invocation[];
}

export type Invocation = Subscription | Unsubscription | KeepAlive | Aggregation

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

    public static aggregation(...invocations: Invocation[]): Aggregation {
        return {type: InvocationType.Aggregation, invocations} as Aggregation;
    }
}

