import { describe, expect, it } from "vitest";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";

describe("sdkEventStore", () => {
  it("appends streamed assistant text into one message per message id", () => {
    let state = createInitialSdkUiState();

    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "正在" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "生成计划" },
    });

    expect(state.activeRunId).toBe("run-1");
    expect(state.messages).toEqual([{ id: "msg-1", role: "assistant", content: "正在生成计划", complete: false }]);
  });

  it("stores approvals, questions, MCP status, raw audit, usage, errors, and task progress", () => {
    let state = createInitialSdkUiState();

    state = reduceSdkUiEvent(state, {
      channel: "tool:approval-required",
      payload: {
        runId: "run-1",
        toolCall: { id: "approval-1", toolName: "mcp-db.query", label: "查询订单", status: "waiting_approval" },
      },
    });
    state = reduceSdkUiEvent(state, {
      channel: "question:required",
      payload: { runId: "run-1", requestId: "question-1", questions: [{ id: "scope", label: "测试范围" }] },
    });
    state = reduceSdkUiEvent(state, {
      channel: "sdk:mcp-status",
      payload: { runId: "run-1", servers: [{ name: "browser", status: "connected" }] },
    });
    state = reduceSdkUiEvent(state, {
      channel: "sdk:raw-message",
      payload: { runId: "run-1", message: { type: "system", subtype: "compact_boundary" } },
    });
    state = reduceSdkUiEvent(state, {
      channel: "sdk:usage",
      payload: { runId: "run-1", raw: { input_tokens: 10, output_tokens: 20 } },
    });
    state = reduceSdkUiEvent(state, {
      channel: "sdk:error",
      payload: { runId: "run-1", message: "网关认证失败", retryable: true },
    });
    state = reduceSdkUiEvent(state, {
      channel: "sdk:task-progress",
      payload: { runId: "run-1", taskId: "task-1", summary: "正在执行子任务" },
    });

    expect(state.approvals).toHaveLength(1);
    expect(state.questions).toHaveLength(1);
    expect(state.mcpServers).toEqual([{ name: "browser", status: "connected" }]);
    expect(state.rawMessages).toHaveLength(1);
    expect(state.usage).toEqual({ input_tokens: 10, output_tokens: 20 });
    expect(state.errors[0].message).toBe("网关认证失败");
    expect(state.tasks[0].summary).toBe("正在执行子任务");
  });
});
