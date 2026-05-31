import type { MainToRendererChannel } from "../ipc/channels";
import type { BugDraft, Evidence, ToolCall } from "../domain/testRun";

export type ModelCapabilities = {
  model: string;
  supportsThinking: boolean;
  supportsJsonSchema: boolean;
  supportsPromptCaching: boolean;
  maxContextWindow: number;
  supportsToolUse: boolean;
  detectedAt: number;
  detectionMethod: "probe" | "heuristic" | "manual";
};

export type SdkMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  complete: boolean;
  thinkingContent?: string;
  thinkingDuration?: string;
  model?: string;
  stopReason?: string;
};

export type RunStats = {
  model?: string;
  durationMs?: number;
  numTurns?: number;
  cost?: unknown;
  modelUsage?: unknown;
  stopReason?: string;
};

export type PermissionDenial = {
  toolName: string;
  raw?: unknown;
};

export type SdkSystemEvent = {
  subtype: string;
  raw: unknown;
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
  status?: string;
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
} | {
  channel: "ui:session-loaded";
  payload: { sessionId: string; messages: SdkMessage[] };
} | {
  channel: "ui:user-message-sent";
  payload: { messageId: string; content: string };
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  /** 缓存命中率（百分比，0-100） */
  cacheHitRate?: number;
  /** 当前会话已使用的上下文 tokens 总量 */
  contextTokens?: number;
  /** LLM 支持的单会话最大上下文 tokens */
  maxContextTokens?: number;
};

export type SdkUiState = {
  activeRunId?: string;
  modelName?: string;
  messages: SdkMessage[];
  approvals: ApprovalRequest[];
  questions: QuestionRequest[];
  mcpServers: McpServerUiStatus[];
  evidence?: Evidence[];
  rawMessages: unknown[];
  usage?: TokenUsage;
  errors: Array<{ message: string; retryable: boolean }>;
  tasks: SdkTaskProgress[];
  sessions: SessionSummary[];
  workspaceModes: Record<string, SessionWorkspaceMode>;
  bugDraft?: BugDraft;
  runStats?: RunStats;
  permissionDenials: PermissionDenial[];
  systemEvents: SdkSystemEvent[];
  toolProgress: Map<string, { toolUseId: string; status: string; progress?: unknown }>;
  taskNotifications: Array<{ taskId: string; status: string; description?: string }>;
  notifications: Array<{ message: string; title?: string; notificationType: string }>;
  rateLimitInfo: unknown | undefined;
  mirrorErrors: Array<{ message: string }>;
  connectionStatus?: {
    state: "connected" | "unverified" | "connecting" | "failed";
    baseUrl: string;
    model: string;
    error?: { code: string; message: string; suggestion: string };
    probedAt: number;
  };
  modelCapabilities?: ModelCapabilities;
  processHealth?: { pid: number | null; status: string; restartCount: number; message: string };
};

export type SdkUiEvent =
  | { channel: MainToRendererChannel; payload: unknown }
  | LocalUiEvent;
