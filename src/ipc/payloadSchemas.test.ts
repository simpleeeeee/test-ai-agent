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

  it("accepts only empty payloads for window controls", () => {
    expect(() => parseRendererToMainPayload("window:minimize", undefined)).not.toThrow();
    expect(() => parseRendererToMainPayload("window:toggle-maximize", undefined)).not.toThrow();
    expect(() => parseRendererToMainPayload("window:close", undefined)).not.toThrow();

    expect(() => parseRendererToMainPayload("window:minimize", { value: true })).toThrow();
    expect(() => parseRendererToMainPayload("window:toggle-maximize", { value: true })).toThrow();
    expect(() => parseRendererToMainPayload("window:close", { value: true })).toThrow();
  });
});
