import {MonoTypeOperatorFunction, Observable} from 'rxjs';

export function addTearDown<T>(tearDown: () => void): MonoTypeOperatorFunction<T> {
    // return (source: Observable<T>) => source.lift(new AddTearDownOperator(tearDown));
    return (source: Observable<T>) => Observable.create(observer => {
        const subscription = source.subscribe(observer);
        return () => {
            subscription.unsubscribe();
            tearDown();
        }
    })
}
