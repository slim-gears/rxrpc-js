import {RxRpcTransport} from './rxrpc-transport'
import {of, Subject} from 'rxjs'
import {RxRpcClient} from './rxrpc-client';
import {Invocation, Subscription, Unsubscription} from './data/invocation';
import {Response} from './data/response';

describe('RxRpc Client test suite', function() {
    let sentMessages: any[];
    let transport: RxRpcTransport;
    let client: RxRpcClient;
    let closedCalled;
    let messageSubject;

    beforeEach(() => {
        messageSubject = new Subject();
        sentMessages = [];
        closedCalled = false;
        transport = {
            connect: () => of({
                messages: messageSubject,
                send: sentMessages.push.bind(sentMessages),
                close: () => {closedCalled = true;}
            })
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
        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        observable.subscribe();
        client.close();
        expect(closedCalled).toBe(true);
    });

    it('Listener is invoked', () => {
        const invocations: Invocation[] = [];
        const responses: Response[] = [];
        const listenerSubscription = client.addListener({
            onInvocation: invocations.push.bind(invocations),
            onResponse: responses.push.bind(responses)
        });

        var observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        var observableSubscription = observable.subscribe();
        expect(invocations.length).toEqual(1);
        observableSubscription.unsubscribe();

        expect(invocations.length).toEqual(2);
        observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        observableSubscription = observable.subscribe();
        expect(invocations.length).toEqual(3);

        listenerSubscription.unsubscribe();
        observableSubscription.unsubscribe();
        expect(invocations.length).toEqual(3);
    })
});
