import {Observable, Operator, OperatorFunction, pipe} from "rxjs";
import {map} from "rxjs/operators";


// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt

/* utf.js - UTF-8 <=> UTF-16 convertion
 *
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0
 * LastModified: Dec 25 1999
 * This library is free.  You can redistribute it and/or modify it.
 */
export function utf8ArrayToStr(array: Uint8Array): string {
    let out, i, len, c;
    let char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while(i < len) {
        c = array[i++];
        switch(c >> 4)
        {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
            // 0xxxxxxx
            out += String.fromCharCode(c);
            break;
            case 12: case 13:
            // 110x xxxx   10xx xxxx
            char2 = array[i++];
            out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
            break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
}

export function fromUtf16(): Operator<Uint8Array, string> {
    return pipe(map(utf8ArrayToStr));
}

export function fromJson(): OperatorFunction<string, any> {
    return src => new Observable(observer => {
        let buffer = ""
        let opened = 0

        function onNextString(str: string) {
            for (let i = 0; (i < str.length) && !observer.closed; ++i) {
                const char = str.charAt(i);
                buffer += char;
                switch (char) {
                    case '{':
                    case '[':
                        ++opened;
                        break;
                    case '}':
                    case ']':
                        --opened;
                        break;
                }
                if (opened == 0 && buffer.length > 0) {
                    observer.next(JSON.parse(buffer))
                    buffer = "";
                }
            }
        }

        const subscription = src.subscribe(onNextString, err => observer.error(err), () => observer.complete())
        observer.add(subscription)
    })
}
