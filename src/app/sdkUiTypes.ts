import type { MainToRendererChannel } from "../ipc/channels";
import type { ToolCall } from "../domain/testRun";

export type SdkMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  complete: boolean;
};

export type ApprovalRequest = {
  runId: string;
  requestId: string;
  toolCall: ToolCall;
};

export type QuestionRequest = {
  runId: string;
  requestId: string;
  questions: unknown[];
};

export type McpServerUiStatus = {
  name: string;
  status: "pending" | "connected" | "failed" | "needs-auth" | "disabled" | string;
  detail?: string;
};

export type SessionSummary = {
  id: string;
  title: string;
  tags: string[];
};

export type SdkTaskProgress = {
  taskId: string;
  summary?: string;
};

export type SdkUiState = {
  activeRunId?: string;
  workspaceModes?: Record<string, unknown>;
  messages: SdkMessage[];
  approvals: ApprovalRequest[];
  questions: QuestionRequest[];
  mcpServers: McpServerUiStatus[];
  evidence?: unknown[];
  rawMessages: unknown[];
  usage?: unknown;
  errors: Array<{ message: string; retryable: boolean }>;
  tasks: SdkTaskProgress[];
  sessions: SessionSummary[];
};

export type SdkUiEvent = {
  channel: MainToRendererChannel;
  payload: unknown;
};
