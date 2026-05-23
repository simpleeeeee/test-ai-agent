import { describe, expect, it } from "vitest";
import { mapSdkMessageToRunEvents, mapPermissionRequestToRunEvent } from "./runEventMapper.js";

describe("mapSdkMessageToRunEvents", () => {
  it("maps text delta stream events", () => {
    const events = mapSdkMessageToRunEvents("run-1", {
      type: "stream_event",
      uuid: "message-1",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "正在生成测试计划" },
      },
    });

    expect(events).toEqual([
      { type: "assistant:text-delta", messageId: "message-1", delta: "正在生成测试计划" },
      { type: "sdk:raw-message", runId: "run-1", message: expect.any(Object) },
    ]);
  });

  it("maps tool use stream start to a tool call", () => {
    const events = mapSdkMessageToRunEvents("run-1", {
      type: "stream_event",
      uuid: "tool-message-1",
      event: {
        type: "content_block_start",
        content_block: {
          type: "tool_use",
          id: "toolu_1",
          name: "mcp__order__create_order",
          input: {},
        },
      },
    });

    expect(events[0]).toEqual({
      type: "tool:call-started",
      toolCall: {
        id: "toolu_1",
        toolName: "mcp__order__create_order",
        label: "调用 mcp__order__create_order",
        status: "running",
        inputSummary: "{}",
      },
    });
  });

  it("maps result messages to session and usage events", () => {
    const events = mapSdkMessageToRunEvents("run-1", {
      type: "result",
      subtype: "success",
      session_id: "session-1",
      usage: { input_tokens: 10 },
      result: "完成",
    });

    expect(events).toEqual([
      { type: "sdk:session-changed", sessionId: "session-1" },
      { type: "sdk:usage", raw: { input_tokens: 10 } },
      { type: "run:status-changed", status: "completed" },
      { type: "sdk:raw-message", runId: "run-1", message: expect.any(Object) },
    ]);
  });

  it("maps task progress system messages", () => {
    const events = mapSdkMessageToRunEvents("run-1", {
      type: "system",
      subtype: "task_progress",
      task_id: "task-1",
      summary: "正在执行订单测试",
    });

    expect(events[0]).toEqual({
      type: "sdk:task-progress",
      taskId: "task-1",
      summary: "正在执行订单测试",
      raw: expect.any(Object),
    });
  });
});

describe("mapPermissionRequestToRunEvent", () => {
  it("maps permission requests to approval-required tool calls", () => {
    expect(mapPermissionRequestToRunEvent("request-1", "mcp__db__query", { sql: "select 1" }, "AI 请求查询订单数据库"))
      .toEqual({
        type: "tool:approval-required",
        toolCall: {
          id: "request-1",
          toolName: "mcp__db__query",
          label: "调用 mcp__db__query",
          status: "waiting_approval",
          inputSummary: "{\"sql\":\"select 1\"}",
          approvalReason: "AI 请求查询订单数据库",
        },
      });
  });
});
