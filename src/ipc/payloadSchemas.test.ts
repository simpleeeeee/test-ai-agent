import { describe, expect, it } from "vitest";
import {
  parseRendererToMainPayload,
  parseMainToRendererPayload,
} from "./payloadSchemas";

describe("IPC payload schemas", () => {
  it("accepts valid run:create payloads", () => {
    expect(parseRendererToMainPayload("run:create", { prompt: "测试订单模块功能" })).toEqual({
      prompt: "测试订单模块功能",
    });
  });

  it("rejects malformed run:create payloads", () => {
    expect(() => parseRendererToMainPayload("run:create", { prompt: "" })).toThrow();
    expect(() => parseRendererToMainPayload("run:create", { prompt: 123 })).toThrow();
  });

  it("accepts approval decisions with optional updated input and permission suggestions", () => {
    expect(parseRendererToMainPayload("tool:approve", {
      runId: "run-1",
      requestId: "approval-1",
      updatedInput: { query: "select 1" },
      applyPermissionSuggestions: true,
    })).toEqual({
      runId: "run-1",
      requestId: "approval-1",
      updatedInput: { query: "select 1" },
      applyPermissionSuggestions: true,
    });
  });

  it("accepts streamed text delta payloads", () => {
    expect(parseMainToRendererPayload("assistant:text-delta", {
      runId: "run-1",
      messageId: "message-1",
      delta: "正在生成测试计划",
    })).toEqual({
      runId: "run-1",
      messageId: "message-1",
      delta: "正在生成测试计划",
    });
  });

  it("accepts streamed thinking delta payloads", () => {
    expect(parseMainToRendererPayload("assistant:thinking-delta", {
      runId: "run-1",
      messageId: "message-1",
      delta: "分析用户需求",
    })).toEqual({
      runId: "run-1",
      messageId: "message-1",
      delta: "分析用户需求",
    });
  });

  it("accepts only empty payloads for window controls", () => {
    expect(() => parseRendererToMainPayload("window:minimize", undefined)).not.toThrow();
    expect(() => parseRendererToMainPayload("window:toggle-maximize", undefined)).not.toThrow();
    expect(() => parseRendererToMainPayload("window:close", undefined)).not.toThrow();

    expect(() => parseRendererToMainPayload("window:minimize", { value: true })).toThrow();
    expect(() => parseRendererToMainPayload("window:toggle-maximize", { value: true })).toThrow();
    expect(() => parseRendererToMainPayload("window:close", { value: true })).toThrow();
  });

  it("accepts tag-session with null tag for clearing", () => {
    const result = parseRendererToMainPayload("run:tag-session", {
      sessionId: "session-1",
      tag: null,
    });
    expect(result).toEqual({ sessionId: "session-1", tag: null });
  });

  it("accepts tag-session with string tag", () => {
    expect(parseRendererToMainPayload("run:tag-session", {
      sessionId: "session-1",
      tag: "reviewed",
    })).toEqual({
      sessionId: "session-1",
      tag: "reviewed",
    });
  });

  it("accepts assistant message started payloads", () => {
    expect(parseMainToRendererPayload("assistant:message-started", {
      runId: "run-1",
      messageId: "msg-1",
      model: "claude-sonnet-4-6",
      usage: { input_tokens: 12 },
    })).toEqual({
      runId: "run-1",
      messageId: "msg-1",
      model: "claude-sonnet-4-6",
      usage: { input_tokens: 12 },
    });
  });

  it("accepts thinking duration and stop reason on assistant completion", () => {
    expect(parseMainToRendererPayload("assistant:message-completed", {
      runId: "run-1",
      messageId: "msg-1",
      thinkingDuration: "1.45s",
      stopReason: "end_turn",
      result: "完成",
    })).toEqual({
      runId: "run-1",
      messageId: "msg-1",
      thinkingDuration: "1.45s",
      stopReason: "end_turn",
      result: "完成",
    });
  });

  it("accepts streamed tool input payloads", () => {
    expect(parseMainToRendererPayload("tool:input-json-delta", {
      runId: "run-1",
      toolCallId: "toolu-1",
      delta: "{\"url\"",
      inputSummary: "{\"url\"",
    })).toEqual({
      runId: "run-1",
      toolCallId: "toolu-1",
      delta: "{\"url\"",
      inputSummary: "{\"url\"",
    });
  });

  it("accepts enriched usage payloads", () => {
    expect(parseMainToRendererPayload("sdk:usage", {
      runId: "run-1",
      raw: { input_tokens: 10 },
      modelUsage: { claude: { input_tokens: 10 } },
      cost: { total_cost_usd: 0.01 },
      durationMs: 1500,
      numTurns: 2,
      model: "claude-sonnet-4-6",
    })).toEqual({
      runId: "run-1",
      raw: { input_tokens: 10 },
      modelUsage: { claude: { input_tokens: 10 } },
      cost: { total_cost_usd: 0.01 },
      durationMs: 1500,
      numTurns: 2,
      model: "claude-sonnet-4-6",
    });
  });

  it("accepts SDK system events", () => {
    expect(parseMainToRendererPayload("sdk:system-event", {
      runId: "run-1",
      subtype: "compact",
      raw: { type: "system", subtype: "compact" },
    })).toEqual({
      runId: "run-1",
      subtype: "compact",
      raw: { type: "system", subtype: "compact" },
    });
  });

  it("rejects tool:input-json-delta with empty delta", () => {
    expect(() => parseMainToRendererPayload("tool:input-json-delta", {
      runId: "run-1",
      toolCallId: "toolu-1",
      delta: "",
      inputSummary: "",
    })).toThrow();
  });

  it("rejects sdk:system-event with empty subtype", () => {
    expect(() => parseMainToRendererPayload("sdk:system-event", {
      runId: "run-1",
      subtype: "",
      raw: {},
    })).toThrow();
  });

  it("accepts valid run:get-context-usage payload", () => {
    expect(parseRendererToMainPayload("run:get-context-usage" as any, {
      runId: "run-1",
    })).toEqual({ runId: "run-1" });
  });

  it("accepts run:read-file payload with optional fields", () => {
    expect(parseRendererToMainPayload("run:read-file" as any, {
      runId: "run-1",
      path: "/tmp/test.log",
      maxBytes: 4096,
      encoding: "utf-8",
    })).toEqual({ runId: "run-1", path: "/tmp/test.log", maxBytes: 4096, encoding: "utf-8" });

    expect(parseRendererToMainPayload("run:read-file" as any, {
      runId: "run-1",
      path: "/tmp/test.log",
    })).toEqual({ runId: "run-1", path: "/tmp/test.log" });
  });

  it("rejects run:read-file with invalid encoding", () => {
    expect(() => parseRendererToMainPayload("run:read-file" as any, {
      runId: "run-1",
      path: "/tmp/test.log",
      encoding: "gbk",
    })).toThrow();
  });

  it("accepts sdk:connection-status connected payload", () => {
    expect(parseMainToRendererPayload("sdk:connection-status", {
      state: "connected",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
      probedAt: 1717171717171,
    })).toEqual({
      state: "connected",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
      probedAt: 1717171717171,
    });
  });

  it("accepts sdk:connection-status failed payload with error", () => {
    expect(parseMainToRendererPayload("sdk:connection-status", {
      state: "failed",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
      error: {
        code: "ENOTFOUND",
        message: "无法解析",
        suggestion: "检查 URL",
      },
      probedAt: 1717171717171,
    })).toEqual({
      state: "failed",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
      error: {
        code: "ENOTFOUND",
        message: "无法解析",
        suggestion: "检查 URL",
      },
      probedAt: 1717171717171,
    });
  });

  it("rejects sdk:connection-status with invalid state", () => {
    expect(() => parseMainToRendererPayload("sdk:connection-status", {
      state: "invalid",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
      probedAt: 1717171717171,
    })).toThrow();
  });

  it("accepts sdk:error with suggestion field", () => {
    expect(parseMainToRendererPayload("sdk:error", {
      runId: "run-1",
      message: "网关认证失败",
      retryable: true,
      suggestion: "检查 API Key 配置是否正确",
    })).toEqual({
      runId: "run-1",
      message: "网关认证失败",
      retryable: true,
      suggestion: "检查 API Key 配置是否正确",
    });
  });

  it("accepts sdk:error without suggestion field (backward compatible)", () => {
    expect(parseMainToRendererPayload("sdk:error", {
      message: "网关认证失败",
      retryable: true,
    })).toEqual({
      message: "网关认证失败",
      retryable: true,
    });
  });

  it("rejects run:get-subagent-messages with missing required fields", () => {
    expect(() => parseRendererToMainPayload("run:get-subagent-messages" as any, {
      runId: "run-1",
    })).toThrow();
  });

  it("accepts settings:save payload with permissionMode, thinkingEffort, thinkingDisplay, and theme", () => {
    const parsed = parseRendererToMainPayload("settings:save", {
      baseUrl: "https://api.example.com",
      apiKey: "sk-test",
      model: "claude-sonnet",
      permissionMode: "plan",
      thinkingEffort: "high",
      thinkingDisplay: "summarized",
      theme: "dark",
    });
    expect(parsed).toHaveProperty("permissionMode", "plan");
    expect(parsed).toHaveProperty("thinkingEffort", "high");
    expect(parsed).toHaveProperty("thinkingDisplay", "summarized");
    expect(parsed).toHaveProperty("theme", "dark");
  });

  it("accepts valid settings:probe-connection payload", () => {
    const parsed = parseRendererToMainPayload("settings:probe-connection" as any, {
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
    });
    expect(parsed).toEqual({
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
    });
  });

  it("rejects settings:probe-connection with empty baseUrl", () => {
    expect(() => parseRendererToMainPayload("settings:probe-connection" as any, {
      baseUrl: "",
      model: "claude-sonnet",
    })).toThrow();
  });
});
