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

  it("keeps ordinary chat and plan events out of test execution mode", () => {
    let state = createInitialSdkUiState();

    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "你好" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "run:plan-ready",
      payload: { runId: "run-1", plan: [] },
    });
    state = reduceSdkUiEvent(state, {
      channel: "question:required",
      payload: { runId: "run-1", requestId: "q-1", questions: [] },
    });

    expect(state.workspaceModes).toEqual({});
  });

  it("marks only the active run as test execution after local confirmation", () => {
    let state = createInitialSdkUiState();

    state = reduceSdkUiEvent(state, {
      channel: "ui:test-execution-confirmed",
      payload: { runId: "run-1" },
    });

    expect(state.workspaceModes).toEqual({
      "run-1": { hasTestExecution: true },
    });
  });

  it("stores backend execution evidence without switching workspace mode by itself", () => {
    let state = createInitialSdkUiState();

    // run-1: tool:approval-required
    state = reduceSdkUiEvent(state, {
      channel: "tool:approval-required",
      payload: {
        runId: "run-1",
        requestId: "req-1",
        toolCall: { id: "tc-1", toolName: "click", label: "点击登录按钮", status: "waiting_approval" },
      },
    });

    // run-2: evidence:created
    state = reduceSdkUiEvent(state, {
      channel: "evidence:created",
      payload: {
        runId: "run-2",
        evidence: { id: "ev-1", type: "screenshot", title: "登录页面截图", summary: "显示登录表单" },
      },
    });

    // run-2: bug-draft:created
    state = reduceSdkUiEvent(state, {
      channel: "bug-draft:created",
      payload: {
        runId: "run-2",
        bugDraft: {
          title: "登录按钮无响应",
          severity: "P1",
          steps: ["点击登录"],
          expected: "跳转到首页",
          actual: "无任何反应",
          evidenceIds: ["ev-1"],
        },
      },
    });

    expect(state.workspaceModes).toEqual({});

    // Evidence should have 1 entry
    expect(state.evidence!).toHaveLength(1);
    expect(state.evidence![0].title).toBe("登录页面截图");

    // Bug draft should be set
    expect(state.bugDraft?.title).toBe("登录按钮无响应");
  });

  it("resets the active conversation for a new chat while preserving session history", () => {
    let state = createInitialSdkUiState();
    state.sessions = [{ id: "run-old", title: "历史会话", tags: [] }];
    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "已有内容" },
    });

    state = reduceSdkUiEvent(state, { channel: "ui:new-chat" });

    expect(state.activeRunId).toBeUndefined();
    expect(state.messages).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(state.sessions).toEqual([{ id: "run-old", title: "历史会话", tags: [] }]);
  });

  it("replaces sessions on ui:sessions-loaded", () => {
    let state = createInitialSdkUiState();
    state.sessions = [{ id: "old", title: "旧的", tags: [] }];

    state = reduceSdkUiEvent(state, {
      channel: "ui:sessions-loaded",
      payload: {
        sessions: [
          { id: "s1", title: "订单回归", tags: ["P1"], lastModified: 1000 },
          { id: "s2", title: "登录测试", tags: [], lastModified: 2000 },
        ],
      },
    });

    expect(state.sessions).toHaveLength(2);
    expect(state.sessions[0]).toEqual({ id: "s1", title: "订单回归", tags: ["P1"], lastModified: 1000 });
    expect(state.sessions[1].title).toBe("登录测试");
  });

  it("preserves sessions across ui:new-chat", () => {
    let state = createInitialSdkUiState();
    state.sessions = [{ id: "s1", title: "历史", tags: [] }];
    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "内容" },
    });

    state = reduceSdkUiEvent(state, { channel: "ui:new-chat" });

    expect(state.activeRunId).toBeUndefined();
    expect(state.messages).toEqual([]);
    expect(state.sessions).toEqual([{ id: "s1", title: "历史", tags: [] }]);
  });
});
