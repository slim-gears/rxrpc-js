import { Operator, Observable, Subscriber, TeardownLogic, MonoTypeOperatorFunction } from "rxjs";

export function addTearDown<T>(tearDown: () => void): MonoTypeOperatorFunction<T> {
    return (source: Observable<T>) => source.lift(new AddTearDownOperator(tearDown));
}

class AddTearDownOperator<T> implements Operator<T, T> {
  constructor(private tearDown: () => void) {

  }

  call(subscriber: Subscriber<T>, source: Observable<T>): TeardownLogic {
      const subscrption: TeardownLogic = source.subscribe(subscriber);
      return () => {
        this.tearDown();
        subscrption.unsubscribe();
      };
  }
}
