import { fromJson } from "./utils";
import {fromArray} from "rxjs/internal/observable/fromArray";
import {toArray} from "rxjs/operators";

describe('Utils test suite', () => {
    test('fromJson test', async done => {
        const strings = fromArray(['[1, 2', ', 3]', '{"test1": "val1', '"}{"data":[0,1,2,{"nested', '": true}]}']);
        const objects = await (strings.pipe(fromJson(), toArray())).toPromise();
        expect(objects.length).toEqual(3)
        expect(objects[0].constructor).toEqual(Array)
        expect(objects[0].length).toEqual(3)
        expect(objects[2].data.constructor).toEqual(Array)
        expect(objects[2].data.length).toEqual(4)
        expect(objects[2].data[3].nested).toEqual(true)
        done()
    })
})
