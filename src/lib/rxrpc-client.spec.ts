import {RxRpcTransport} from './rxrpc-transport'
import {of} from 'rxjs'
import {RxRpcClient} from './rxrpc-client';
import {Subscription, Unsubscription} from './data/invocation';

describe('RxRpc Client test suite', function() {
    let sentMessages: any[];
    let transport: RxRpcTransport;
    let client: RxRpcClient;
    let closedCalled;

    beforeEach(() => {
        sentMessages = [];
        closedCalled = false;
        transport = {
            messages: of(),
            send: sentMessages.push.bind(sentMessages),
            close: () => {closedCalled = true;}
        };
        client = new RxRpcClient(transport);
    });

    it('Method invocation sends message', () => {
        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        expect(sentMessages.length).toEqual(0);
        observable.subscribe();
        expect(sentMessages.length).toEqual(1);
        const invocation = <Subscription>sentMessages[0];
        expect(invocation.method).toEqual('testMethod');
        expect(invocation.invocationId).toEqual(1);
        expect(invocation.arguments['arg1']).toEqual(1);
        expect(invocation.arguments['arg2']).toEqual('2');
    });

    it('Unsubscription sends message', () => {
        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});

        expect(sentMessages.length).toEqual(0);

        const subscription = observable.subscribe();
        expect(sentMessages.length).toEqual(1);
        const subscriptionInvocation = <Subscription>sentMessages[0];
        expect(subscriptionInvocation.invocationId).toEqual(1);

        subscription.unsubscribe();
        expect(sentMessages.length).toEqual(2);
        const unsubscriptionInvocation = <Unsubscription>sentMessages[1];
        expect(unsubscriptionInvocation.invocationId).toEqual(1);
    });

    it('Client closes transport', () => {
        client.close();
        expect(closedCalled).toBe(true);
    })
});
