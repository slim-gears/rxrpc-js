import { RxRpcClient } from './rxrpc-client';
import { Observable } from 'rxjs';

export interface SampleRequest {
    
}

export class SampleEndpointClient {
    constructor(private client: RxRpcClient) {
    }

    public futureStringMethod(msg: string, request: SampleRequest): Observable<string> {
        return this.client.invoke('futureStringMethod', {
            msg: msg,
            request: request
        });
    }

    public intMethod(request: SampleRequest): Observable<number> {
        return this.client.invoke('intMethod', {
            request: request
        });
    }
}
