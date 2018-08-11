import {} from 'jasmine'
import {RxRpcTransport} from './rxrpc-transport'
import {Observable, of} from 'rxjs'
import { RxRpcClient } from './rxrpc-client';
import { Result } from './data/result';
import { Invocation } from './data/invocation';

describe("RxRpc Client test suite", function() {
    let sentMessages: string[];
    let transport: RxRpcTransport;
    let client: RxRpcClient;

    beforeEach(() => {
        sentMessages = [];
        transport = {
            messages: of(),
            send: sentMessages.push.bind(sentMessages)
        };
        client = new RxRpcClient(transport);
    })

    it("Method invocation sends message", () => {
        client.invoke('testMethod', {arg1: 1, arg2: "2"});
        expect(sentMessages.length).toEqual(1);
        const invocation = <Invocation>JSON.parse(sentMessages[0]);
        expect(invocation.method).toEqual('testMethod');
        expect(invocation.invocationId).toEqual(1);
        expect(invocation.arguments['arg1']).toEqual(1);
        expect(invocation.arguments['arg2']).toEqual("2");
    });
});
