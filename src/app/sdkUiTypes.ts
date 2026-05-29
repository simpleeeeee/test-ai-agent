import type { MainToRendererChannel } from "../ipc/channels";
import type { BugDraft, Evidence, ToolCall } from "../domain/testRun";

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
  lastModified?: number;
  createdAt?: number;
  summary?: string;
  gitBranch?: string;
  cwd?: string;
};

export type SdkTaskProgress = {
  taskId: string;
  summary?: string;
};

export type SessionWorkspaceMode = {
  hasTestExecution: boolean;
};

export type LocalUiEvent = {
  channel: "ui:test-execution-confirmed";
  payload: { runId: string };
} | {
  channel: "ui:new-chat";
  payload?: undefined;
} | {
  channel: "ui:sessions-loaded";
  payload: { sessions: SessionSummary[] };
};

export type SdkUiState = {
  activeRunId?: string;
  messages: SdkMessage[];
  approvals: ApprovalRequest[];
  questions: QuestionRequest[];
  mcpServers: McpServerUiStatus[];
  evidence?: Evidence[];
  rawMessages: unknown[];
  usage?: unknown;
  errors: Array<{ message: string; retryable: boolean }>;
  tasks: SdkTaskProgress[];
  sessions: SessionSummary[];
  workspaceModes: Record<string, SessionWorkspaceMode>;
  bugDraft?: BugDraft;
};

export type SdkUiEvent =
  | { channel: MainToRendererChannel; payload: unknown }
  | LocalUiEvent;
