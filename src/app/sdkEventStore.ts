import type { BugDraft, Evidence } from "../domain/testRun";
import type { ApprovalRequest, McpServerUiStatus, QuestionRequest, SdkUiEvent, SdkUiState, TokenUsage } from "./sdkUiTypes";

function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

function normalizeUsage(raw: unknown): TokenUsage {
  if (!raw || typeof raw !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }
  const r = raw as Record<string, unknown>;
  const num = (key: string): number | undefined => {
    const v = r[key];
    return typeof v === "number" ? v : undefined;
  };
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

  if (event.channel === "assistant:message-completed") {
    const messageId = String(payload.messageId);
    const thinkingDuration = typeof payload.thinkingDuration === "string" ? payload.thinkingDuration : undefined;
    return {
      ...state,
      activeRunId,
      messages: state.messages.map((message) =>
        message.id === messageId
          ? { ...message, complete: true, ...(thinkingDuration !== undefined ? { thinkingDuration } : {}) }
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
    return { ...state, activeRunId, usage: normalizeUsage(payload.raw) };
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
    return {
      ...state,
      activeRunId,
      tasks: state.tasks.length >= 200
        ? [...state.tasks.slice(-199), { taskId: String(payload.taskId), summary: typeof payload.summary === "string" ? payload.summary : undefined }]
        : [...state.tasks, { taskId: String(payload.taskId), summary: typeof payload.summary === "string" ? payload.summary : undefined }],
    };
  }

  return { ...state, activeRunId };
}
