import { ResultType } from "./result-type";
import { ErrorInfo } from "./error-info";

export interface Result {
    type: ResultType;
    data?: any;
    error?: ErrorInfo;
}
