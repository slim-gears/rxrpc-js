import {RxRpcHttpConnection, RxRpcHttpTransport} from './rxrpc-http-transport';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>

function delay(ms: number){
    return new Promise( resolve => setTimeout(resolve, ms) );
}

describe('RxRpc Http Transport test suite', function () {
    let transport: RxRpcHttpTransport;
    let clientId: string;
    let incomingMessages: any[];
    let resp: {}

    beforeEach(() => {
        transport = new RxRpcHttpTransport("https://funnyName/");
        clientId = "12345678";
        incomingMessages = [];
        resp = {
            headers: {"x-rpc-client-id": clientId}
        };
    });

    it('Connect', async () => {
        mockedAxios.post.mockImplementation(() => Promise.resolve(resp));

        transport.connect().subscribe(connection => incomingMessages.push(connection['clientId']))
        await delay(1000);
        expect(incomingMessages[0]).toEqual(clientId)
    })

    it('Poll multiple messages with data as JSON', async () => {
        const data1 = "{\"invocationId\":1,\"result\":{\"type\":\"Data\",\"data\":\"Hello, Angular #0\",\"error\":null}}"
        const data2 = "{\"invocationId\":1,\"result\":{\"type\":\"Data\",\"data\":\"Hello, Angular #1\",\"error\":null}}"
        resp['data'] = JSON.parse(`[${data1},\n${data2}]`)
        mockedAxios.post.mockImplementation(() => Promise.resolve(resp));

        transport.connect().subscribe(connection => connection.poll().subscribe(msg => {
            incomingMessages.push(msg);
        }))
        await delay(1000);
        expect(incomingMessages.length).toEqual(2);
        expect(incomingMessages[0]).toEqual(JSON.parse(data1));
        expect(incomingMessages[1]).toEqual(JSON.parse(data2));
    })

    it('Poll with data as JSON', async () => {
        const data = "{\"invocationId\":1,\"result\":{\"type\":\"Data\",\"data\":\"Hello, Angular #0\",\"error\":null}}"
        resp['data'] = JSON.parse(`[${data}]`)
        mockedAxios.post.mockImplementation(() => Promise.resolve(resp));

        transport.connect().subscribe(connection => connection.poll().subscribe(msg => {
            incomingMessages.push(msg);
        }))
        await delay(1000);
        expect(incomingMessages.length).toEqual(1);
        expect(incomingMessages[0]).toEqual(JSON.parse(data));
    })

    it('Close', async () => {
        mockedAxios.post.mockImplementation(() => Promise.resolve(resp));

        transport.connect().subscribe(connection => incomingMessages.push(connection))
        await delay(1000);
        const connection =  incomingMessages[0] as RxRpcHttpConnection;
        connection.close()
        expect(connection['pollingSubscription'].closed).toEqual(true)
    })

    it('Error', async () => {
        mockedAxios.post.mockImplementation(() => Promise.resolve(resp));

        transport.connect().subscribe(connection => incomingMessages.push(connection))
        await delay(1000);
        const connection =  incomingMessages[0] as RxRpcHttpConnection;
        connection.error(null)
        expect(connection['pollingSubscription'].closed).toEqual(true)
    })
})
