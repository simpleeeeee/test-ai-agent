import type { BugDraft, Evidence } from "../domain/testRun";
import type { ApprovalRequest, McpServerUiStatus, QuestionRequest, SdkUiEvent, SdkUiState, TokenUsage } from "./sdkUiTypes";

function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

function normalizeUsage(raw: unknown): TokenUsage {
  if (!raw || typeof raw !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }
  let r = raw as Record<string, unknown>;
  const num = (key: string): number | undefined => {
    const v = r[key];
    return typeof v === "number" ? v : undefined;
  };

  const hasInputOutput = (num("input_tokens") ?? num("inputTokens")) !== undefined
    && (num("output_tokens") ?? num("outputTokens")) !== undefined;

  // 兼容 1：total_tokens 替代分项（国产 API 常见）
  if (!hasInputOutput && typeof r.total_tokens === "number") {
    r.input_tokens = Math.round(r.total_tokens * 0.75);
    r.output_tokens = Math.round(r.total_tokens * 0.25);
  }

  // 兼容 2：嵌套 usage（response.usage）
  if (!r.input_tokens && !r.inputTokens && r.response && typeof r.response === "object") {
    const resp = r.response as Record<string, unknown>;
    if (resp.usage && typeof resp.usage === "object") {
      r = { ...r, ...(resp.usage as Record<string, unknown>) };
    }
  }

  // 兼容 3：prompt_tokens / completion_tokens（OpenAI 风格）
  if (!r.input_tokens && !r.inputTokens && typeof r.prompt_tokens === "number") {
    r.input_tokens = r.prompt_tokens;
  }
  if (!r.output_tokens && !r.outputTokens && typeof r.completion_tokens === "number") {
    r.output_tokens = r.completion_tokens;
  }

  return {
    inputTokens: num("input_tokens") ?? num("inputTokens") ?? 0,
    outputTokens: num("output_tokens") ?? num("outputTokens") ?? 0,
    ...(num("cache_creation_input_tokens") !== undefined || num("cacheCreationInputTokens") !== undefined
      ? { cacheCreationInputTokens: (num("cache_creation_input_tokens") ?? num("cacheCreationInputTokens")) as number }
      : {}),
    ...(num("cache_read_input_tokens") !== undefined || num("cacheReadInputTokens") !== undefined
      ? { cacheReadInputTokens: (num("cache_read_input_tokens") ?? num("cacheReadInputTokens")) as number }
      : {}),
    ...(num("context_tokens") !== undefined || num("contextTokens") !== undefined
      ? { contextTokens: (num("context_tokens") ?? num("contextTokens")) as number }
      : {}),
    ...(num("max_context_tokens") !== undefined || num("maxContextTokens") !== undefined
      ? { maxContextTokens: (num("max_context_tokens") ?? num("maxContextTokens")) as number }
      : {}),
  };
}

function runIdFrom(payload: Record<string, unknown>) {
  return typeof payload.runId === "string" ? payload.runId : undefined;
}

function markHasTestExecution(state: SdkUiState, runId: string | undefined): SdkUiState {
  if (!runId) return state;
  if (state.workspaceModes[runId]?.hasTestExecution) return state;
  return {
    ...state,
    workspaceModes: {
      ...state.workspaceModes,
      [runId]: { hasTestExecution: true },
    },
  };
}

export function createInitialSdkUiState(): SdkUiState {
  return {
    workspaceModes: {},
    messages: [],
    approvals: [],
    questions: [],
    mcpServers: [],
    evidence: [],
    rawMessages: [],
    errors: [],
    tasks: [],
    sessions: [],
    permissionDenials: [],
    systemEvents: [],
    runStats: undefined,
    toolProgress: new Map(),
    taskNotifications: [],
    notifications: [],
    rateLimitInfo: undefined,
    mirrorErrors: [],
  };
}

export function reduceSdkUiEvent(state: SdkUiState, event: SdkUiEvent): SdkUiState {
  const payload = payloadRecord(event.payload);
  const activeRunId = runIdFrom(payload) ?? state.activeRunId;

  if (event.channel === "ui:new-chat") {
    return {
      ...createInitialSdkUiState(),
      sessions: state.sessions,
    };
  }

  if (event.channel === "ui:sessions-loaded") {
    return {
      ...state,
      sessions: (event.payload as any).sessions as typeof state.sessions,
    };
  }

  if (event.channel === "ui:session-loaded") {
    return {
      ...createInitialSdkUiState(),
      sessions: state.sessions,
      activeRunId: event.payload.sessionId,
      messages: event.payload.messages,
    };
  }

  if (event.channel === "ui:user-message-sent") {
    return {
      ...state,
      activeRunId,
      messages: [...state.messages, { id: event.payload.messageId, role: "user" as const, content: event.payload.content, complete: true }],
    };
  }

  if (event.channel === "ui:test-execution-confirmed") {
    return markHasTestExecution({ ...state, activeRunId }, activeRunId);
  }

  if (event.channel === "assistant:text-delta") {
    const messageId = String(payload.messageId);
    const delta = typeof payload.delta === "string" ? payload.delta : "";
    const existing = state.messages.find((message) => message.id === messageId);
    const messages = existing
      ? state.messages.map((message) => message.id === messageId ? { ...message, content: message.content + delta } : message)
      : [...state.messages, { id: messageId, role: "assistant" as const, content: delta, complete: false }];
    return { ...state, activeRunId, messages };
  }

  if (event.channel === "assistant:thinking-delta") {
    const messageId = String(payload.messageId);
    const delta = typeof payload.delta === "string" ? payload.delta : "";
    const existing = state.messages.find((message) => message.id === messageId);
    const messages = existing
      ? state.messages.map((message) =>
          message.id === messageId
            ? { ...message, thinkingContent: (message.thinkingContent ?? "") + delta }
            : message,
        )
      : [...state.messages, { id: messageId, role: "assistant" as const, content: "", complete: false, thinkingContent: delta }];
    return { ...state, activeRunId, messages };
  }

  if (event.channel === "assistant:message-started") {
    const messageId = String(payload.messageId);
    const model = typeof payload.model === "string" ? payload.model : undefined;
    const existing = state.messages.find((m) => m.id === messageId);
    const messages = existing
      ? state.messages.map((m) => m.id === messageId ? { ...m, ...(model ? { model } : {}) } : m)
      : [...state.messages, { id: messageId, role: "assistant" as const, content: "", complete: false, ...(model ? { model } : {}) }];
    return {
      ...state,
      activeRunId,
      messages,
      ...(model ? { modelName: model, runStats: { ...state.runStats, model } } : {}),
      ...(payload.usage ? { usage: normalizeUsage(payload.usage) } : {}),
    };
  }

  if (event.channel === "assistant:message-completed") {
    const messageId = String(payload.messageId);
    const thinkingDuration = typeof payload.thinkingDuration === "string" ? payload.thinkingDuration : undefined;
    const stopReason = typeof payload.stopReason === "string" ? payload.stopReason : undefined;
    return {
      ...state,
      activeRunId,
      runStats: { ...state.runStats, ...(stopReason ? { stopReason } : {}) },
      messages: state.messages.map((message) =>
        message.id === messageId
          ? { ...message, complete: true, ...(thinkingDuration !== undefined ? { thinkingDuration } : {}), ...(stopReason !== undefined ? { stopReason } : {}) }
          : message,
      ),
    };
  }

  if (event.channel === "tool:approval-required") {
    const approvals = state.approvals.length >= 200
      ? state.approvals
      : [...state.approvals, payload as unknown as ApprovalRequest];
    return { ...state, activeRunId, approvals };
  }

  if (event.channel === "tool:input-json-delta") {
    const toolCallId = String(payload.toolCallId);
    const inputSummary = typeof payload.inputSummary === "string" ? payload.inputSummary : "";
    const approvals = state.approvals.map((a) =>
      a.toolCall.id === toolCallId
        ? { ...a, toolCall: { ...a.toolCall, inputSummary, streamedInput: inputSummary } }
        : a,
    );
    return { ...state, activeRunId, approvals };
  }

  if (event.channel === "question:required") {
    const questions = state.questions.length >= 200
      ? state.questions
      : [...state.questions, payload as unknown as QuestionRequest];
    return { ...state, activeRunId, questions };
  }

  if (event.channel === "question:answered") {
    const requestId = String(payload.requestId);
    return { ...state, activeRunId, questions: state.questions.filter((question) => question.requestId !== requestId) };
  }

  if (event.channel === "evidence:created") {
    const current = state.evidence ?? [];
    const evidence = current.length >= 200
      ? current
      : [...current, payload.evidence as Evidence];
    return { ...state, activeRunId, evidence };
  }

  if (event.channel === "bug-draft:created") {
    return { ...state, activeRunId, bugDraft: payload.bugDraft as BugDraft };
  }

  if (event.channel === "sdk:mcp-status") {
    return { ...state, activeRunId, mcpServers: (payload.servers as McpServerUiStatus[]) ?? [] };
  }

  if (event.channel === "sdk:raw-message") {
    const rawMessages = state.rawMessages.length >= 200
      ? [...state.rawMessages.slice(-199), payload.message]
      : [...state.rawMessages, payload.message];
    return { ...state, activeRunId, rawMessages };
  }

  if (event.channel === "sdk:usage") {
    const usage = normalizeUsage(payload.raw);
    if (usage.cacheReadInputTokens && usage.inputTokens > 0) {
      usage.cacheHitRate = Math.round((usage.cacheReadInputTokens / usage.inputTokens) * 100);
    }
    return {
      ...state,
      activeRunId,
      usage,
      runStats: {
        ...state.runStats,
        ...(typeof payload.model === "string" ? { model: payload.model } : {}),
        ...(typeof payload.durationMs === "number" ? { durationMs: payload.durationMs } : {}),
        ...(typeof payload.numTurns === "number" ? { numTurns: payload.numTurns } : {}),
        ...(payload.cost !== undefined ? { cost: payload.cost } : {}),
        ...(payload.modelUsage !== undefined ? { modelUsage: payload.modelUsage } : {}),
      },
      ...(typeof payload.model === "string" ? { modelName: payload.model } : {}),
    };
  }

  if (event.channel === "sdk:error") {
    return {
      ...state,
      activeRunId,
      errors: state.errors.length >= 200
        ? [...state.errors.slice(-199), { message: String(payload.message), retryable: Boolean(payload.retryable) }]
        : [...state.errors, { message: String(payload.message), retryable: Boolean(payload.retryable) }],
    };
  }

  if (event.channel === "sdk:task-progress") {
    const entry = {
      taskId: String(payload.taskId),
      summary: typeof payload.summary === "string" ? payload.summary : undefined,
      status: typeof payload.status === "string" ? payload.status : undefined,
    };
    const idx = state.tasks.findIndex(t => t.taskId === entry.taskId);
    const tasks = idx >= 0
      ? state.tasks.map((t, i) => i === idx ? { ...t, ...entry } : t)
      : [...state.tasks, entry];
    return { ...state, activeRunId, tasks: tasks.length > 200 ? tasks.slice(-200) : tasks };
  }

  if (event.channel === "sdk:permission-denied") {
    const denial = { toolName: String(payload.toolName), raw: payload.raw };
    return {
      ...state,
      activeRunId,
      permissionDenials: state.permissionDenials.length >= 200
        ? [...state.permissionDenials.slice(-199), denial]
        : [...state.permissionDenials, denial],
      errors: state.errors.length >= 200
        ? [...state.errors.slice(-199), { message: `权限被拒绝：${denial.toolName}`, retryable: false }]
        : [...state.errors, { message: `权限被拒绝：${denial.toolName}`, retryable: false }],
    };
  }

  if (event.channel === "sdk:tool-progress") {
    const next = new Map(state.toolProgress);
    next.set(String(payload.toolUseId), {
      toolUseId: String(payload.toolUseId),
      status: String(payload.status ?? "running"),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
    });
    return { ...state, activeRunId, toolProgress: next };
  }

  if (event.channel === "sdk:task-notification") {
    const entry = { taskId: String(payload.taskId), status: String(payload.status), description: typeof payload.description === "string" ? payload.description : undefined };
    return { ...state, activeRunId, taskNotifications: state.taskNotifications.length >= 200 ? [...state.taskNotifications.slice(-199), entry] : [...state.taskNotifications, entry] };
  }

  if (event.channel === "sdk:notification") {
    const entry = { message: String(payload.message), title: typeof payload.title === "string" ? payload.title : undefined, notificationType: String(payload.notificationType) };
    return { ...state, activeRunId, notifications: state.notifications.length >= 200 ? [...state.notifications.slice(-199), entry] : [...state.notifications, entry] };
  }

  if (event.channel === "sdk:rate-limit") {
    return { ...state, activeRunId, rateLimitInfo: payload.info };
  }

  if (event.channel === "sdk:mirror-error") {
    const entry = { message: String(payload.message) };
    return { ...state, activeRunId, mirrorErrors: state.mirrorErrors.length >= 200 ? [...state.mirrorErrors.slice(-199), entry] : [...state.mirrorErrors, entry] };
  }

  if (event.channel === "sdk:system-event") {
    const systemEvent = { subtype: String(payload.subtype), raw: payload.raw };
    let nextState = {
      ...state,
      activeRunId,
      systemEvents: state.systemEvents.length >= 200
        ? [...state.systemEvents.slice(-199), systemEvent]
        : [...state.systemEvents, systemEvent],
    };

    // 进程健康状态更新
    if (String(payload.subtype) === "process_health") {
      const ph = payload.raw as { pid?: number | null; status?: string; restartCount?: number; message?: string } | undefined;
      nextState = {
        ...nextState,
        processHealth: {
          pid: typeof ph?.pid === "number" ? ph.pid : null,
          status: typeof ph?.status === "string" ? ph.status : "unknown",
          restartCount: typeof ph?.restartCount === "number" ? ph.restartCount : 0,
          message: typeof ph?.message === "string" ? ph.message : "",
        },
      };
    }

    // 能力降级时添加用户通知
    if (String(payload.subtype) === "capability_degraded") {
      const raw = payload.raw as { model?: string; degradations?: Array<{ feature: string; reason: string }> } | undefined;
      const degradationsList = raw?.degradations ?? [];
      const modelLabel = raw?.model ? ` (${raw.model})` : "";
      const features = degradationsList.map((d) => d.feature).join("、");
      const notification = {
        message: `模型${modelLabel}的以下功能已被自动降级：${features}`,
        notificationType: "warning",
      };
      nextState = {
        ...nextState,
        notifications: nextState.notifications.length >= 200
          ? [...nextState.notifications.slice(-199), notification]
          : [...nextState.notifications, notification],
      };
    }

    return nextState;
  }

  if (event.channel === "sdk:connection-status") {
    const { runId: _runId, ...status } = payload;
    return {
      ...state,
      activeRunId,
      connectionStatus: status as SdkUiState["connectionStatus"],
    };
  }

  return { ...state, activeRunId };
}
