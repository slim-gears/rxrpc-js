import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport'
import {of, Subject, throwError} from 'rxjs'
import {RxRpcClient} from './rxrpc-client';
import {Invocation, Subscription, Unsubscription} from './data/invocation';
import {Response} from './data/response';
import {delay} from "./rxrpc-http-transport.spec";

describe('RxRpc Client test suite', function() {
    let sentMessages: any[];
    let transport: RxRpcTransport;
    let client: RxRpcClient;
    let closedCalled;
    let messageSubject;
    let errors: any[] = [];
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

    it('Method invocation sends message', async () => {
        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        expect(sentMessages.length).toEqual(0);
        observable.subscribe();
        await delay(500)
        expect(sentMessages.length).toEqual(1);
        const invocation = <Subscription>sentMessages[0];
        expect(invocation.method).toEqual('testMethod');
        expect(invocation.invocationId).toEqual(1);
        expect(invocation.arguments['arg1']).toEqual(1);
        expect(invocation.arguments['arg2']).toEqual('2');
    });

    it('Unsubscription sends message', async () => {
        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});

        expect(sentMessages.length).toEqual(0);

        const subscription = observable.subscribe();
        await delay(500)

        expect(sentMessages.length).toEqual(1);
        const subscriptionInvocation = <Subscription>sentMessages[0];
        expect(subscriptionInvocation.invocationId).toEqual(1);

        subscription.unsubscribe();
        await delay(500)

        expect(sentMessages.length).toEqual(2);
        const unsubscriptionInvocation = <Unsubscription>sentMessages[1];
        expect(unsubscriptionInvocation.invocationId).toEqual(1);
        expect(errors.length).toEqual(0);
    });

    it('Client closes transport', async () => {
        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        observable.subscribe();
        await delay(500)
        client.close();
        expect(closedCalled).toBe(true);
        expect(errors.length).toEqual(0);
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
        expect(errors.length).toEqual(0);
    });

    it('On error - report to all subscribers', async () => {
        messageSubject.error(new Error("Connection error"));
        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        let receivedErrors = [];
        observable.subscribe(() => {}, error => receivedErrors.push(error));
        await delay(500);
        expect(receivedErrors.length).toEqual(1);
        expect(receivedErrors[0].message).toEqual("Connection error");
        expect(errors.length).toEqual(0);
    });

    it('On error - failed to connect', async() => {
        let receivedErrors = [];
        transport = { connect: () => {
          return throwError("Connection failed");
        }};
        client = new RxRpcClient(transport);

        const observable = client.invoke('testMethod', {arg1: 1, arg2: '2'});
        observable.subscribe(() => {}, error => receivedErrors.push(error));
        await delay(500);
        expect(receivedErrors.length).toEqual(1);
        expect(receivedErrors[0]).toEqual("Connection failed");
    });

    it('Shared invocation when arguments match should reuse existing', async () => {
       const observable1 = client.invokeShared('testMethod', 0, {arg1: 1, arg2: '2'});
       const observable2 = client.invokeShared('testMethod', 0, {arg1: 1, arg2: '2'});
       expect(sentMessages.length).toEqual(0);

       const subscription1 = observable1.subscribe();
       await delay(500)

       expect(sentMessages.length).toEqual(1);
       expect(sentMessages[0]).toEqual({ type: 'Subscription', invocationId: 1, method: 'testMethod', arguments: { arg1: 1, arg2: '2' } });

       const subscription2 = observable2.subscribe();
       await delay(500)
       expect(sentMessages.length).toEqual(1);

       subscription1.unsubscribe();
       await delay(500)
       expect(sentMessages.length).toEqual(1);

       subscription2.unsubscribe();
       await delay(500)
       expect(sentMessages.length).toEqual(2);
       expect(sentMessages[1]).toEqual({ type: 'Unsubscription', invocationId: 1 });
       expect(errors.length).toEqual(0);
    });

    it('Shared replay should replay only provided number of entries', async () => {
        const observable1 = client.invokeShared('testMethod', 2, {arg1: 1, arg2: '2'});
        const observable2 = client.invokeShared('testMethod', 2, {arg1: 1, arg2: '2'});
        expect(sentMessages.length).toEqual(0);

        const receivedData1 = [];
        observable1.subscribe(next => receivedData1.push(next));
        await delay(500)

        messageSubject.next({
            invocationId: 1,
            result: {type: "Data", data: "data1", error: null}
        });
        messageSubject.next({
            invocationId: 1,
            result: {type: "Data", data: "data2", error: null}
        });
        messageSubject.next({
            invocationId: 1,
            result: {type: "Data", data: "data3", error: null}
        });
        const receivedData2 = [];
        observable2.subscribe(next => receivedData2.push(next));
        expect(receivedData1.length).toEqual(3);
        expect(receivedData2.length).toEqual(2);
        expect(receivedData2[0]).toEqual("data2");
        expect(receivedData2[1]).toEqual("data3");
    })
});
