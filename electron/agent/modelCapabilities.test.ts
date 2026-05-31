import { describe, expect, it, vi } from "vitest";
import {
  detectModelCapabilities,
  clearCapabilitiesCache,
} from "./modelCapabilities.js";
import type { ModelCapabilities } from "./modelCapabilities.js";

describe("detectModelCapabilities", () => {
  it("first call detects, second call returns cached (probes only called once)", async () => {
    clearCapabilitiesCache();

    let probeCallCount = 0;
    const probeFn = vi.fn(async ({ prompt, options }: { prompt: string; options: Record<string, unknown> }) => {
      probeCallCount++;
      return { result: "ok" };
    });

    const sdk = { query: probeFn };
    const model = "test-model-v1";

    const first = await detectModelCapabilities(sdk, model);
    expect(first.model).toBe(model);
    expect(first.detectionMethod).toBe("probe");
    expect(probeCallCount).toBeGreaterThan(0);
    const firstCallCount = probeCallCount;

    const second = await detectModelCapabilities(sdk, model);
    expect(second.model).toBe(model);
    expect(second.detectionMethod).toBe("probe");
    // 第二次调用不应触发新的探测
    expect(probeCallCount).toBe(firstCallCount);
  });

  it("probe success returns capabilities with supportsToolUse and supportsThinking true", async () => {
    clearCapabilitiesCache();

    const sdk = {
      query: async () => ({ result: "ok" }),
    };
    const model = "full-featured-model";

    const caps = await detectModelCapabilities(sdk, model);

    expect(caps.model).toBe(model);
    expect(caps.supportsToolUse).toBe(true);
    expect(caps.supportsThinking).toBe(true);
    expect(caps.detectionMethod).toBe("probe");
    expect(caps.detectedAt).toBeGreaterThan(0);
    // JSON Schema 和 Prompt Caching 默认 false（不探测）
    expect(caps.supportsJsonSchema).toBe(false);
    expect(caps.supportsPromptCaching).toBe(false);
  });

  it("probe failure falls back to conservative defaults with detectionMethod: heuristic", async () => {
    clearCapabilitiesCache();

    const sdk = {
      query: async () => {
        throw new Error("API unavailable");
      },
    };
    const model = "broken-model";

    const caps = await detectModelCapabilities(sdk, model);

    expect(caps.model).toBe(model);
    expect(caps.supportsToolUse).toBe(false);
    expect(caps.supportsThinking).toBe(false);
    expect(caps.supportsJsonSchema).toBe(false);
    expect(caps.supportsPromptCaching).toBe(false);
    expect(caps.maxContextWindow).toBe(128000);
    expect(caps.detectionMethod).toBe("heuristic");
    expect(caps.detectedAt).toBeGreaterThan(0);
  });

  it("model name is correctly stored in the result", async () => {
    clearCapabilitiesCache();

    const sdk = {
      query: async () => ({ result: "ok" }),
    };
    const models = ["claude-sonnet-4-20250514", "deepseek-v3", "custom-model-v2"];

    for (const model of models) {
      const caps = await detectModelCapabilities(sdk, model);
      expect(caps.model).toBe(model);
    }
  });

  it("caches per model independently", async () => {
    clearCapabilitiesCache();

    let modelACalls = 0;
    let modelBCalls = 0;

    const sdkA = {
      query: vi.fn(async () => {
        modelACalls++;
        return { result: "ok" };
      }),
    };
    const sdkB = {
      query: vi.fn(async () => {
        modelBCalls++;
        return { result: "ok" };
      }),
    };

    const modelA = "model-a";
    const modelB = "model-b";

    await detectModelCapabilities(sdkA, modelA);
    expect(modelACalls).toBeGreaterThan(0);

    await detectModelCapabilities(sdkB, modelB);
    expect(modelBCalls).toBeGreaterThan(0);

    const aBefore = modelACalls;
    const bBefore = modelBCalls;

    // 再次探测 modelA —— 应使用缓存
    await detectModelCapabilities(sdkA, modelA);
    expect(modelACalls).toBe(aBefore);

    // modelB 调用次数不应受 modelA 影响
    expect(modelBCalls).toBe(bBefore);
  });
});
