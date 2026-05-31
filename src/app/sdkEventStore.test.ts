import { describe, expect, it } from "vitest";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";
import type { SdkUiEvent } from "./sdkUiTypes";

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
      payload: { runId: "run-1", raw: { inputTokens: 10, outputTokens: 20 } },
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
    expect(state.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(state.errors[0].message).toBe("网关认证失败");
    expect(state.tasks[0].summary).toBe("正在执行子任务");
  });

  it("normalizes snake_case usage payload to camelCase TokenUsage", () => {
    const initialState = createInitialSdkUiState();
    const event: SdkUiEvent = {
      channel: "sdk:usage",
      payload: {
        runId: "run-1",
        raw: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 30, context_tokens: 500, max_context_tokens: 10000 },
      },
    };
    const state = reduceSdkUiEvent(initialState, event);
    expect(state.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: 30,
      cacheHitRate: 30,
      contextTokens: 500,
      maxContextTokens: 10000,
    });
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

  it("loads a selected session transcript into the active conversation", () => {
    let state = createInitialSdkUiState();
    state.sessions = [{ id: "s1", title: "订单回归", tags: [] }];
    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "run-old", messageId: "msg-old", delta: "旧内容" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "ui:session-loaded",
      payload: {
        sessionId: "s1",
        messages: [
          { id: "user-1", role: "user", content: "历史提问", complete: true },
          { id: "assistant-1", role: "assistant", content: "历史回复", complete: true },
        ],
      },
    });

    expect(state.activeRunId).toBe("s1");
    expect(state.messages).toEqual([
      { id: "user-1", role: "user", content: "历史提问", complete: true },
      { id: "assistant-1", role: "assistant", content: "历史回复", complete: true },
    ]);
    expect(state.sessions).toEqual([{ id: "s1", title: "订单回归", tags: [] }]);
    expect(state.errors).toEqual([]);
  });

  it("adds a user message to the message list when ui:user-message-sent is dispatched", () => {
    let state = createInitialSdkUiState();
    state = reduceSdkUiEvent(state, {
      channel: "ui:user-message-sent",
      payload: { messageId: "user-1", content: "帮我分析订单风险" },
    });

    expect(state.messages).toEqual([
      { id: "user-1", role: "user", content: "帮我分析订单风险", complete: true },
    ]);
  });

  it("appends thinking content to an existing assistant message", () => {
    let state = createInitialSdkUiState();
    // First add an assistant message stub
    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "计划已生成" },
    });
    // Then add thinking to it
    state = reduceSdkUiEvent(state, {
      channel: "assistant:thinking-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "分析用户需求…" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "assistant:thinking-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "检查测试范围…" },
    });

    expect(state.messages[0].thinkingContent).toBe("分析用户需求…检查测试范围…");
  });

  it("creates a stub message when thinking arrives before any text delta (real API order)", () => {
    let state = createInitialSdkUiState();
    // Thinking arrives FIRST (as in the real Anthropic API and fallback API)
    state = reduceSdkUiEvent(state, {
      channel: "assistant:thinking-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "分析用户需求…" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "assistant:thinking-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "匹配测试策略…" },
    });
    // Text delta arrives AFTER thinking
    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "计划已生成" },
    });

    expect(state.messages[0].role).toBe("assistant");
    expect(state.messages[0].thinkingContent).toBe("分析用户需求…匹配测试策略…");
    expect(state.messages[0].content).toBe("计划已生成");
    expect(state.messages[0].complete).toBe(false);
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

  it("stores assistant message metadata from message_start", () => {
    const state = reduceSdkUiEvent(createInitialSdkUiState(), {
      channel: "assistant:message-started" as any,
      payload: { runId: "run-1", messageId: "msg-1", model: "claude-sonnet-4-6", usage: { input_tokens: 12 } },
    });

    expect(state.activeRunId).toBe("run-1");
    expect(state.modelName).toBe("claude-sonnet-4-6");
    expect(state.usage).toEqual({ inputTokens: 12, outputTokens: 0 });
    expect(state.messages).toEqual([
      { id: "msg-1", role: "assistant", content: "", complete: false, model: "claude-sonnet-4-6" },
    ]);
  });

  it("stores completion metadata on assistant messages and run stats", () => {
    let state = createInitialSdkUiState();
    state = reduceSdkUiEvent(state, {
      channel: "assistant:thinking-delta",
      payload: { runId: "run-1", messageId: "msg-1", delta: "分析" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "assistant:message-completed",
      payload: { runId: "run-1", messageId: "msg-1", thinkingDuration: "1.45s", stopReason: "end_turn", result: "完成" },
    });

    expect(state.messages[0]).toMatchObject({
      id: "msg-1",
      role: "assistant",
      complete: true,
      thinkingDuration: "1.45s",
      stopReason: "end_turn",
    });
    expect(state.runStats?.stopReason).toBe("end_turn");
  });

  it("sdk:tool-progress updates map", () => {
    const state = createInitialSdkUiState();
    const next = reduceSdkUiEvent(state, { channel: "sdk:tool-progress", payload: { toolUseId: "t1", status: "running", progress: "50%" } });
    expect(next.toolProgress.get("t1")).toEqual({ toolUseId: "t1", status: "running", progress: "50%" });
  });

  it("sdk:rate-limit sets rateLimitInfo", () => {
    const state = createInitialSdkUiState();
    const next = reduceSdkUiEvent(state, { channel: "sdk:rate-limit", payload: { info: { tokensRemaining: 100 } } });
    expect(next.rateLimitInfo).toEqual({ tokensRemaining: 100 });
  });

  it("sdk:notification appends with 200 cap", () => {
    const state = createInitialSdkUiState();
    const next = reduceSdkUiEvent(state, { channel: "sdk:notification", payload: { message: "test", notificationType: "info" } });
    expect(next.notifications).toHaveLength(1);
    expect(next.notifications[0].message).toBe("test");
  });

  it("stores streamed tool input, enriched usage, permission denials, and system events", () => {
    let state = createInitialSdkUiState();
    state = reduceSdkUiEvent(state, {
      channel: "tool:approval-required",
      payload: {
        runId: "run-1",
        requestId: "req-1",
        toolCall: { id: "toolu-1", toolName: "mcp__browser__navigate", label: "导航", status: "waiting_approval" },
      },
    });
    state = reduceSdkUiEvent(state, {
      channel: "tool:input-json-delta" as any,
      payload: { runId: "run-1", toolCallId: "toolu-1", delta: "{\"url\"", inputSummary: "{\"url\"" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "sdk:usage",
      payload: { runId: "run-1", raw: { input_tokens: 1 }, cost: { total_cost_usd: 0.01 }, durationMs: 100, numTurns: 2, model: "claude" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "sdk:permission-denied" as any,
      payload: { runId: "run-1", toolName: "Write", raw: { reason: "blocked" } },
    });
    state = reduceSdkUiEvent(state, {
      channel: "sdk:system-event" as any,
      payload: { runId: "run-1", subtype: "compact", raw: { type: "system", subtype: "compact" } },
    });

    expect(state.approvals[0].toolCall.inputSummary).toBe("{\"url\"");
    expect(state.approvals[0].toolCall.streamedInput).toBe("{\"url\"");
    expect(state.runStats).toEqual({
      model: "claude",
      durationMs: 100,
      numTurns: 2,
      cost: { total_cost_usd: 0.01 },
    });
    expect(state.permissionDenials).toEqual([{ toolName: "Write", raw: { reason: "blocked" } }]);
    expect(state.systemEvents).toEqual([{ subtype: "compact", raw: { type: "system", subtype: "compact" } }]);
  });

  it("sdk:connection-status stores connected state", () => {
    const state = createInitialSdkUiState();
    const next = reduceSdkUiEvent(state, {
      channel: "sdk:connection-status" as any,
      payload: {
        runId: "run-1",
        state: "connected",
        baseUrl: "https://api.anthropic.com",
        model: "claude-sonnet-4-6",
        probedAt: 1717171717171,
      },
    });

    expect(next.connectionStatus).toEqual({
      state: "connected",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
      probedAt: 1717171717171,
    });
  });

  it("normalizes total_tokens into estimated input/output split", () => {
    const state = reduceSdkUiEvent(createInitialSdkUiState(), {
      channel: "sdk:usage",
      payload: { runId: "run-1", raw: { total_tokens: 4000 } },
    });
    expect(state.usage).toEqual({ inputTokens: 3000, outputTokens: 1000 });
  });

  it("maps prompt_tokens / completion_tokens to inputTokens / outputTokens", () => {
    const state = reduceSdkUiEvent(createInitialSdkUiState(), {
      channel: "sdk:usage",
      payload: { runId: "run-1", raw: { prompt_tokens: 500, completion_tokens: 200 } },
    });
    expect(state.usage).toEqual({ inputTokens: 500, outputTokens: 200 });
  });

  it("extracts tokens from nested response.usage", () => {
    const state = reduceSdkUiEvent(createInitialSdkUiState(), {
      channel: "sdk:usage",
      payload: { runId: "run-1", raw: { response: { usage: { input_tokens: 100, output_tokens: 50 } } } },
    });
    expect(state.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it("sdk:connection-status stores failed state with error detail", () => {
    const state = createInitialSdkUiState();
    const next = reduceSdkUiEvent(state, {
      channel: "sdk:connection-status" as any,
      payload: {
        runId: "run-1",
        state: "failed",
        baseUrl: "https://api.anthropic.com",
        model: "claude-sonnet-4-6",
        error: {
          code: "ENOTFOUND",
          message: "无法解析 API 网关地址",
          suggestion: "检查 baseUrl 配置",
        },
        probedAt: 1717171717171,
      },
    });

    expect(next.connectionStatus).toEqual({
      state: "failed",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
      error: {
        code: "ENOTFOUND",
        message: "无法解析 API 网关地址",
        suggestion: "检查 baseUrl 配置",
      },
      probedAt: 1717171717171,
    });
  });
});
