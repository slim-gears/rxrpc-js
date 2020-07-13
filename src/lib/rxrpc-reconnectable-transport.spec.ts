import {RxRpcConnection, RxRpcTransport} from './rxrpc-transport';
import {NEVER, Observable, of, Subject, throwError} from 'rxjs';
import {RxRpcReconnectableTransport} from './rxrpc-reconnectable-transport';
import {concatAll, take} from 'rxjs/operators';

describe('RxRpc Reconnectable Transport test suite', function() {
    let receivedConnections: RxRpcConnection[];
    let receivedMessages: string[];
    let receivedErrors: any[];

    function nonCompletingMessages(...messages: string[]): Observable<any> {
        return of(of(...messages), NEVER).pipe(concatAll());
    }

    function connectionFromMessages(messages: Observable<any>) {
        return <RxRpcConnection>{
            messages: messages,
            send: () => {},
            close: () => {},
            error: () => {}
        };
    }

    function createReconnectableTransport(...connections: RxRpcConnection[]) {
        const transport = <RxRpcTransport>{
            connect: () =>
                of(connections.shift())
        };
        return RxRpcReconnectableTransport.of(transport, 1000, 32000);
    }

    beforeEach(() => {
        receivedConnections = [];
        receivedMessages = [];
        receivedErrors = [];
    });

    test('Should retry connection when could not connect', done => {
        const reconnectableTransport = createReconnectableTransport(
            connectionFromMessages(throwError("connection failed")),
            connectionFromMessages(throwError("connection failed")),
            connectionFromMessages(nonCompletingMessages("test message")));
        reconnectableTransport.connect()
            .pipe(take(1))
            .subscribe(connection => {
                receivedConnections.push(connection);
                connection.messages.subscribe(
                    msg => receivedMessages.push(msg),
                    err => receivedErrors.push(err))
                },
                err => {fail(`Unexpected error: ${err}`)},
                () => {
                    expect(receivedErrors.length).toEqual(0);
                    expect(receivedMessages.length).toEqual(1);
                    expect(receivedMessages[0]).toEqual("test message");
                    expect(receivedConnections.length).toEqual(1);
                    done();
                });
    }, 20000);

    test('Should retry connection when received error', done => {
        const messages = new Subject();
        const reconnectableTransport = createReconnectableTransport(
            connectionFromMessages(messages),
            connectionFromMessages(messages),
            connectionFromMessages(nonCompletingMessages("test message 2")));

        reconnectableTransport.connect()
            .pipe(take(2))
            .subscribe(connection => {
                receivedConnections.push(connection);
                connection.messages.subscribe(
                    msg => receivedMessages.push(msg),
                    err => receivedErrors.push(err))
                },
                err => {fail(`Unexpected error: ${err}`)},
                () => {
                    expect(receivedErrors.length).toEqual(1);
                    expect(receivedMessages.length).toEqual(2);
                    expect(receivedMessages[1]).toEqual("test message 2");
                    expect(receivedConnections.length).toEqual(2);
                    done();
                });

        messages.next("test message 1");
        expect(receivedErrors.length).toEqual(0);
        expect(receivedMessages.length).toEqual(1);
        expect(receivedMessages[0]).toEqual("test message 1");
        expect(receivedConnections.length).toEqual(1);

        messages.error("");
    }, 20000);
});