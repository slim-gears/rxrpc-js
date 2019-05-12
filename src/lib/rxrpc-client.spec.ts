import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport'
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
    let errors: any[];
    let connection: RxRpcConnection;

    beforeEach(() => {
        messageSubject = new Subject();
        sentMessages = [];
        closedCalled = false;
        connection = {
            messages: messageSubject,
            send: msg => sentMessages.push(msg),
            close: () => {closedCalled = true;},
            error: error => { messageSubject.error(error); errors.push(error); }
        };

        transport = { connect: () => of(connection) };
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

        let observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        let observableSubscription = observable.subscribe();
        expect(invocations.length).toEqual(1);
        observableSubscription.unsubscribe();

        expect(invocations.length).toEqual(2);
        observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        observableSubscription = observable.subscribe();
        expect(invocations.length).toEqual(3);

        listenerSubscription.unsubscribe();
        observableSubscription.unsubscribe();
        expect(invocations.length).toEqual(3);
    });

    it('On error - report to all subscribers', () => {
        messageSubject.error(new Error("Connection error"));
        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        let receivedErrors = [];
        observable.subscribe(() => {}, error => receivedErrors.push(error));
        expect(receivedErrors.length).toEqual(1);
        expect(receivedErrors[0].message).toEqual("Connection error");
    });

    it('Shared invocation when arguments match should reuse existing', () => {
       const observable1 = client.invokeShared('testMethod', {arg1: 1, arg2: '2'});
       const observable2 = client.invokeShared('testMethod', {arg1: 1, arg2: '2'});
       expect(sentMessages.length).toEqual(0);

       const subscription1 = observable1.subscribe();
       expect(sentMessages.length).toEqual(1);
       expect(sentMessages[0]).toEqual({ type: 'Subscription', invocationId: 1, method: 'testMethod', arguments: { arg1: 1, arg2: '2' } });

       const subscription2 = observable2.subscribe();
       expect(sentMessages.length).toEqual(1);

       subscription1.unsubscribe();
       expect(sentMessages.length).toEqual(1);

       subscription2.unsubscribe();
       expect(sentMessages.length).toEqual(2);
       expect(sentMessages[1]).toEqual({ type: 'Unsubscription', invocationId: 1 });
    });
});
