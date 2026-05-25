import type { ApprovalRequest, McpServerUiStatus, QuestionRequest, SdkUiEvent, SdkUiState } from "./sdkUiTypes";

function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

function runIdFrom(payload: Record<string, unknown>) {
  return typeof payload.runId === "string" ? payload.runId : undefined;
}

export function createInitialSdkUiState(): SdkUiState {
  return {
    messages: [],
    approvals: [],
    questions: [],
    mcpServers: [],
    evidence: [],
    rawMessages: [],
    errors: [],
    tasks: [],
    sessions: [],
  };
}

export function reduceSdkUiEvent(state: SdkUiState, event: SdkUiEvent): SdkUiState {
  const payload = payloadRecord(event.payload);
  const activeRunId = runIdFrom(payload) ?? state.activeRunId;

  if (event.channel === "assistant:text-delta") {
    const messageId = String(payload.messageId);
    const delta = typeof payload.delta === "string" ? payload.delta : "";
    const existing = state.messages.find((message) => message.id === messageId);
    const messages = existing
      ? state.messages.map((message) => message.id === messageId ? { ...message, content: message.content + delta } : message)
      : [...state.messages, { id: messageId, role: "assistant" as const, content: delta, complete: false }];
    return { ...state, activeRunId, messages };
  }

  if (event.channel === "assistant:message-completed") {
    const messageId = String(payload.messageId);
    return {
      ...state,
      activeRunId,
      messages: state.messages.map((message) => message.id === messageId ? { ...message, complete: true } : message),
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
    return { ...state, activeRunId, usage: payload.raw };
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

  if (event.channel === "evidence:created") {
    const evidence = state.evidence ?? [];
    return {
      ...state,
      activeRunId,
      evidence: evidence.length >= 200
        ? [...evidence.slice(-199), payload]
        : [...evidence, payload],
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
