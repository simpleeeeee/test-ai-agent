import { describe, expect, it } from "vitest";
import { mapSdkMessageToRunEvents, mapPermissionRequestToRunEvent, SdkRunEventMapperSession } from "./runEventMapper.js";

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

  it("maps message_start metadata and keeps the stable assistant message id", () => {
    const mapper = new SdkRunEventMapperSession("run-1");

    const events = mapper.map({
      type: "stream_event",
      uuid: "uuid-1",
      event: {
        type: "message_start",
        message: {
          id: "msg-1",
          model: "claude-sonnet-4-6",
          usage: { input_tokens: 42 },
        },
      },
    });

    expect(events).toEqual([
      {
        type: "assistant:message-started",
        messageId: "msg-1",
        model: "claude-sonnet-4-6",
        usage: { input_tokens: 42 },
      },
      { type: "sdk:usage", raw: { input_tokens: 42 }, model: "claude-sonnet-4-6" },
      { type: "sdk:raw-message", runId: "run-1", message: expect.any(Object) },
    ]);
  });

  it("maps thinking deltas and emits duration on message stop", () => {
    const times = [1000, 2450];
    const mapper = new SdkRunEventMapperSession("run-1", () => times.shift() ?? 2450);

    mapper.map({
      type: "stream_event",
      uuid: "uuid-1",
      event: { type: "message_start", message: { id: "msg-1" } },
    });
    mapper.map({
      type: "stream_event",
      uuid: "uuid-2",
      event: { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
    });
    const deltaEvents = mapper.map({
      type: "stream_event",
      uuid: "uuid-3",
      event: { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "分析需求" } },
    });
    mapper.map({
      type: "stream_event",
      uuid: "uuid-4",
      event: { type: "content_block_stop", index: 0 },
    });
    const stopEvents = mapper.map({
      type: "stream_event",
      uuid: "uuid-5",
      event: { type: "message_stop" },
    });

    expect(deltaEvents[0]).toEqual({
      type: "assistant:thinking-delta",
      messageId: "msg-1",
      delta: "分析需求",
    });
    expect(stopEvents[0]).toEqual({
      type: "assistant:message-completed",
      messageId: "msg-1",
      thinkingDuration: "1.45s",
    });
  });

  it("maps streamed tool input JSON deltas to the active tool call", () => {
    const mapper = new SdkRunEventMapperSession("run-1");

    mapper.map({
      type: "stream_event",
      uuid: "uuid-1",
      event: {
        type: "content_block_start",
        index: 1,
        content_block: { type: "tool_use", id: "toolu-1", name: "mcp__browser__navigate", input: {} },
      },
    });
    const events = mapper.map({
      type: "stream_event",
      uuid: "uuid-2",
      event: { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{\"url\":\"https://" } },
    });

    expect(events[0]).toEqual({
      type: "tool:input-json-delta",
      toolCallId: "toolu-1",
      delta: "{\"url\":\"https://",
      inputSummary: "{\"url\":\"https://",
    });
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
