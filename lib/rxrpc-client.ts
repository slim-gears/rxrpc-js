import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface Result {

}

@Injectable()
export class RxRpcClient {
    constructor(private http: HttpClient) {
    }

    public test(): string {
        return 'Hello, World!';
    }
}