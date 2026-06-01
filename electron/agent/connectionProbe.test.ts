import { describe, expect, it, vi } from "vitest";
import { probeConnection } from "./connectionProbe.js";

describe("probeConnection", () => {
  it("probe succeeds → returns state: connected", async () => {
    const warmQuery = {
      query: (_prompt: string) => ({
        next: async () => ({ value: { type: "assistant" }, done: false }) as IteratorResult<unknown, void>,
      }),
    };

    const status = await probeConnection(warmQuery, {
      baseUrl: "https://gateway.example.com",
      model: "test-model",
    });

    expect(status.state).toBe("connected");
    expect(status.baseUrl).toBe("https://gateway.example.com");
    expect(status.model).toBe("test-model");
    expect(status.probedAt).toBeGreaterThan(0);
  });

  it("probe calls query.return() to clean up the generator after success", async () => {
    const returnSpy = vi.fn();
    const warmQuery = {
      query: (_prompt: string) => ({
        next: async () => ({ value: { type: "assistant" }, done: false }) as IteratorResult<unknown, void>,
        return: returnSpy,
      }),
    };

    const status = await probeConnection(warmQuery, {
      baseUrl: "https://gateway.example.com",
      model: "test-model",
    });

    expect(status.state).toBe("connected");
    expect(returnSpy).toHaveBeenCalled();
  });

  it("probe calls query.return() to clean up the generator after failure", async () => {
    const returnSpy = vi.fn();
    const error = new Error("connection refused");
    (error as any).code = "ECONNREFUSED";

    const warmQuery = {
      query: (_prompt: string) => ({
        next: async () => { throw error; },
        return: returnSpy,
      }),
    };

    const status = await probeConnection(warmQuery, {
      baseUrl: "https://gateway.example.com",
      model: "test-model",
    });

    expect(status.state).toBe("failed");
    expect(returnSpy).toHaveBeenCalled();
  });

  it("probe throws ENOTFOUND → returns state: failed with error.code = ENOTFOUND and Chinese message", async () => {
    const notFoundError = new Error("getaddrinfo ENOTFOUND gateway.example.com");
    (notFoundError as any).code = "ENOTFOUND";

    const warmQuery = {
      query: (_prompt: string) => ({
        next: async () => {
          throw notFoundError;
        },
      }),
    };

    const status = await probeConnection(warmQuery, {
      baseUrl: "https://gateway.example.com",
      model: "test-model",
    });

    expect(status.state).toBe("failed");
    expect(status.error).toBeDefined();
    expect(status.error!.code).toBe("ENOTFOUND");
    expect(status.error!.message).toBeDefined();
    expect(status.error!.message.length).toBeGreaterThan(0);
    // 错误消息应为中文，不应包含原始英文错误文本
    expect(status.error!.message).not.toMatch(/getaddrinfo/i);
    expect(status.error!.suggestion).toBeDefined();
    expect(status.error!.suggestion.length).toBeGreaterThan(0);
    expect(status.probedAt).toBeGreaterThan(0);
  });

  it("probe hangs (timeout) → returns state: failed with error.code = TIMEOUT", async () => {
    // 创建一个永远不 resolve 的 next()
    const warmQuery = {
      query: (_prompt: string) => ({
        next: () => new Promise<IteratorResult<unknown, void>>(() => {
          // 永不 resolve，模拟挂起
        }),
      }),
    };

    const status = await probeConnection(warmQuery, {
      baseUrl: "https://gateway.example.com",
      model: "test-model",
      timeoutMs: 10, // 极短超时，加快测试
    });

    expect(status.state).toBe("failed");
    expect(status.error).toBeDefined();
    expect(status.error!.code).toBe("TIMEOUT");
    expect(status.error!.message).toBeDefined();
    expect(status.error!.message.length).toBeGreaterThan(0);
    expect(status.error!.suggestion).toBeDefined();
    expect(status.error!.suggestion.length).toBeGreaterThan(0);
    expect(status.probedAt).toBeGreaterThan(0);
  });
});
