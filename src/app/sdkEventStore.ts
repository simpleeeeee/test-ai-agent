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
    return { ...state, activeRunId, approvals: [...state.approvals, payload as unknown as ApprovalRequest] };
  }

  if (event.channel === "question:required") {
    return { ...state, activeRunId, questions: [...state.questions, payload as unknown as QuestionRequest] };
  }

  if (event.channel === "question:answered") {
    const requestId = String(payload.requestId);
    return { ...state, activeRunId, questions: state.questions.filter((question) => question.requestId !== requestId) };
  }

  if (event.channel === "sdk:mcp-status") {
    return { ...state, activeRunId, mcpServers: (payload.servers as McpServerUiStatus[]) ?? [] };
  }

  if (event.channel === "sdk:raw-message") {
    return { ...state, activeRunId, rawMessages: [...state.rawMessages, payload.message] };
  }

  if (event.channel === "sdk:usage") {
    return { ...state, activeRunId, usage: payload.raw };
  }

  if (event.channel === "sdk:error") {
    return {
      ...state,
      activeRunId,
      errors: [...state.errors, { message: String(payload.message), retryable: Boolean(payload.retryable) }],
    };
  }

  if (event.channel === "sdk:task-progress") {
    return {
      ...state,
      activeRunId,
      tasks: [...state.tasks, { taskId: String(payload.taskId), summary: typeof payload.summary === "string" ? payload.summary : undefined }],
    };
  }

  return { ...state, activeRunId };
}
