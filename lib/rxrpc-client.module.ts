import {NgModule} from '@angular/core'
import {HttpClientModule} from '@angular/common/http'
import { RxRpcClient } from './rxrpc-client';

@NgModule({
    imports: [
        HttpClientModule
    ],
    providers: [RxRpcClient]
})
export class RxRpcClientModule {
}
