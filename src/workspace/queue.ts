export type Serialized = <T>(op: () => Promise<T>) => Promise<T>;

export function createQueue(): Serialized {
  let tail: Promise<unknown> = Promise.resolve();
  return function serialize<T>(op: () => Promise<T>): Promise<T> {
    const run = tail.then(op);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
