import { describe, expect, it } from "vitest";
import { AsyncMessageQueue } from "./asyncMessageQueue.js";

describe("AsyncMessageQueue", () => {
  it("yields pushed messages in order", async () => {
    const queue = new AsyncMessageQueue<string>();
    queue.push("first");
    queue.push("second");
    queue.close();

    const received: string[] = [];
    for await (const message of queue) {
      received.push(message);
    }

    expect(received).toEqual(["first", "second"]);
  });

  it("wakes pending iterators when a message is pushed", async () => {
    const queue = new AsyncMessageQueue<string>();
    const next = queue[Symbol.asyncIterator]().next();

    queue.push("later");

    await expect(next).resolves.toEqual({ value: "later", done: false });
  });

  it("propagates errors to pending iterators", async () => {
    const queue = new AsyncMessageQueue<string>();
    const next = queue[Symbol.asyncIterator]().next();

    queue.fail(new Error("queue failed"));

    await expect(next).rejects.toThrow("queue failed");
  });
});
