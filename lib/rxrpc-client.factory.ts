import { RxRpcClient } from "./rxrpc-client";
import { Injectable } from "@angular/core";

@Injectable()
export class RxRpcClientFactory {
    public connect(url: string): RxRpcClient {
        return RxRpcClient.connect(url);
    }
}
