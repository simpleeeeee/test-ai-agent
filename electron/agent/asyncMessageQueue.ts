type Resolver<T> = {
  resolve: (value: IteratorResult<T>) => void;
  reject: (error: Error) => void;
};

export class AsyncMessageQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private readonly resolvers: Resolver<T>[] = [];
  private closed = false;
  private error: Error | undefined;

  push(value: T) {
    if (this.closed) {
      throw new Error("Cannot push to a closed queue");
    }
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver.resolve({ value, done: false });
      return;
    }
    this.values.push(value);
  }

  close() {
    this.closed = true;
    while (this.resolvers.length > 0) {
      this.resolvers.shift()?.resolve({ value: undefined, done: true });
    }
  }

  fail(error: Error) {
    this.error = error;
    while (this.resolvers.length > 0) {
      this.resolvers.shift()?.reject(error);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.error) {
          return Promise.reject(this.error);
        }
        const value = this.values.shift();
        if (value !== undefined) {
          return Promise.resolve({ value, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<T>>((resolve, reject) => {
          this.resolvers.push({ resolve, reject });
        });
      },
    };
  }
}
