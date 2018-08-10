export interface Invocation {
    invocationId: number;
    method: string;
    arguments: Map<string, any>;
}
