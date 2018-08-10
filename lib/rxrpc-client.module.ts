import {NgModule} from '@angular/core'
import {HttpClientModule} from '@angular/common/http'
import { RxRpcClientFactory } from './rxrpc-client.factory';

@NgModule({
    imports: [
        HttpClientModule
    ],
    providers: [RxRpcClientFactory]
})
export class RxRpcClientModule {
}
