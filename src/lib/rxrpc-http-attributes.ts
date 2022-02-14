
export class HttpAttributes {
    static ClientIdAttribute = "X-RPC-CLIENT-ID";
    static DefaultOptions = {
        activePollingPeriodMillis: 200,
        idlePollingPeriodMillis: 2000,
        pollingRetryCount: 10,
        observeEnabled: false
    }
}
