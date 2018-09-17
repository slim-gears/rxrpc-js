import {NgModule} from '@angular/core'
import {RxRpcClient} from './rxrpc-client';
import {RxRpcInvoker} from './rxrpc-invoker';

@NgModule({
    providers: [{provide: RxRpcInvoker, useClass: RxRpcClient}]
})
export class RxRpcClientModule {
}
