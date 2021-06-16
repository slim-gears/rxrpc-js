import {
    RxRpcHttpConnection,
    RxRpcHttpTransport,
    RxRpcHttpTransportInterceptor,
    RxRpcHttpTransportRequestConfig
} from './rxrpc-http-transport';
import axios from 'axios';
import {Observable, of} from "rxjs";
import {HttpAttributes} from "./rxrpc-http-attributes";

jest.mock('axios');

function delay(ms: number){
    return new Promise( resolve => setTimeout(resolve, ms) );
}

describe('RxRpc Http Transport test suite', function () {
    let transport: RxRpcHttpTransport;
    let clientId: string;
    let incomingMessages: any[];
    let resp: {}

    let interceptors: RxRpcHttpTransportInterceptor[] = [];
    let headerKey1 = "hk1";
    let headerKey2 = "hk2"
    let headerValue1 = "value1";
    let headerValue2 = "value2";
    let mockedAxios: jest.Mocked<typeof axios>

    beforeEach(() => {
        mockedAxios = axios as jest.Mocked<typeof axios>
        interceptors.push(new class implements RxRpcHttpTransportInterceptor {
            intercept(requestConfig: RxRpcHttpTransportRequestConfig): Observable<RxRpcHttpTransportRequestConfig> {
                requestConfig.headers[headerKey1] = headerValue1;
                return of(requestConfig);
            }
        })
        interceptors.push(new class implements RxRpcHttpTransportInterceptor {
            intercept(requestConfig: RxRpcHttpTransportRequestConfig): Observable<RxRpcHttpTransportRequestConfig> {
                requestConfig.headers[headerKey2] = headerValue2;
                return of(requestConfig);
            }
        })

        transport = new RxRpcHttpTransport("https://funnyName/", {interceptors: interceptors});

        clientId = "12345678";
        incomingMessages = [];
        resp = {
            headers: {"x-rpc-client-id": clientId}
        };
    });

    afterEach(() => {
        mockedAxios.post.mockReset();
        interceptors = [];
    });

    it('Connect', async () => {
        mockAndVerifyExpectedHeaders();
        transport.connect().subscribe(connection => incomingMessages.push(connection['clientId']))
        await delay(1000);
        expect(incomingMessages[0]).toEqual(clientId)
    })

    it('Poll multiple messages with data as JSON', async () => {
        const data1 = "{\"invocationId\":1,\"result\":{\"type\":\"Data\",\"data\":\"Hello, Angular #0\",\"error\":null}}"
        const data2 = "{\"invocationId\":1,\"result\":{\"type\":\"Data\",\"data\":\"Hello, Angular #1\",\"error\":null}}"
        resp['data'] = JSON.parse(`[${data1},\n${data2}]`)
        mockAndVerifyExpectedHeaders();
        transport.connect().subscribe(connection => {
            mockAndVerifyExpectedHeadersWithClientId();
            connection.poll().subscribe(msg => {
                incomingMessages.push(msg);
            })
        })
        await delay(1000);
        expect(incomingMessages.length).toEqual(2);
        expect(incomingMessages[0]).toEqual(JSON.parse(data1));
        expect(incomingMessages[1]).toEqual(JSON.parse(data2));
    })

    it('Poll with data as JSON', async () => {
        const data = "{\"invocationId\":1,\"result\":{\"type\":\"Data\",\"data\":\"Hello, Angular #0\",\"error\":null}}"
        resp['data'] = JSON.parse(`[${data}]`)
        mockAndVerifyExpectedHeaders();
        transport.connect().subscribe(connection => {
            mockAndVerifyExpectedHeadersWithClientId();
            connection.poll().subscribe(msg => {
                incomingMessages.push(msg);
            })
        })
        await delay(1000);
        expect(incomingMessages.length).toEqual(1);
        expect(incomingMessages[0]).toEqual(JSON.parse(data));
    })

    it('Close', async () => {
        mockAndVerifyExpectedHeaders();
        transport.connect().subscribe(connection => incomingMessages.push(connection))
        await delay(1000);
        const connection =  incomingMessages[0] as RxRpcHttpConnection;
        mockAndVerifyExpectedHeadersWithClientId();
        connection.close()
        expect(connection['pollingSubscription'].closed).toEqual(true)
    })

    it('Error', async () => {
        mockAndVerifyExpectedHeaders();
        transport.connect().subscribe(connection => incomingMessages.push(connection))
        await delay(1000);
        const connection =  incomingMessages[0] as RxRpcHttpConnection;
        mockAndVerifyExpectedHeadersWithClientId();
        connection.error(null)
        expect(connection['pollingSubscription'].closed).toEqual(true)
    })

    function mockAndVerifyExpectedHeaders()   {
        mockAndVerifyHeaders(getHeaders());
    }
    function mockAndVerifyExpectedHeadersWithClientId()   {
        mockAndVerifyHeaders(getHeadersWithClientId());
    }
    function mockAndVerifyHeaders(expectedHeaders: {}) {
        mockedAxios.post.mockImplementation((url, msg, options) => {
            expect(options.headers).toEqual(expectedHeaders);
            return Promise.resolve(resp);
        });
    }

    function getHeadersWithClientId() {
        let expectedHeaders = getHeaders();
        expectedHeaders[HttpAttributes.ClientIdAttribute] = clientId;
        return expectedHeaders;
    }

    function getHeaders() {
        let expectedHeaders = {};
        expectedHeaders[headerKey1] = headerValue1;
        expectedHeaders[headerKey2] = headerValue2;
        return expectedHeaders;
    }
})
