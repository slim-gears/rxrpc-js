import { ErrorInfo } from "./error-info";

export enum InvocationType {
    Data,
    Complete,
    Error
}

export interface Result {
    type: InvocationType;
    data?: any;
    error?: ErrorInfo;
}
