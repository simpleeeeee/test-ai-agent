export type RunStatus =
  | "idle"
  | "planning"
  | "waiting_confirmation"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "blocked"
  | "stopped";

export type ToolCallStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export type TestPlanStep = {
  id: string;
  title: string;
  status: "pending" | "running" | "passed" | "failed" | "blocked";
};

export type ToolCall = {
  id: string;
  toolName: string;
  label: string;
  status: ToolCallStatus;
  inputSummary?: string;
  outputSummary?: string;
  approvalReason?: string;
};

export type Evidence = {
  id: string;
  type: "screenshot" | "api_response" | "database_record" | "log" | "dom";
  title: string;
  summary: string;
  uri?: string;
};

export type BugDraft = {
  title: string;
  severity: "P0" | "P1" | "P2" | "P3";
  steps: string[];
  expected: string;
  actual: string;
  evidenceIds: string[];
};

export interface CreateInitialRunInput {
  prompt: string;
  projectName: string;
  environmentName: string;
  agentName: string;
}

export interface TestRun {
  id: string;
  title: string;
  userPrompt: string;
  status: RunStatus;
  projectName: string;
  environmentName: string;
  agentName: string;
  plan: TestPlanStep[];
  toolCalls: ToolCall[];
  evidence: Evidence[];
  bugDraft?: BugDraft;
}

export type RunEvent =
  | { type: "run:planning" }
  | { type: "run:plan-ready"; plan: TestPlanStep[] }
  | { type: "run:status-changed"; status: RunStatus }
  | { type: "tool:call-started"; toolCall: ToolCall }
  | { type: "tool:approval-required"; toolCall: ToolCall }
  | { type: "tool:call-completed"; toolCallId: string; outputSummary?: string }
  | { type: "tool:call-failed"; toolCallId: string; outputSummary?: string }
  | { type: "evidence:created"; evidence: Evidence }
  | { type: "bug-draft:created"; bugDraft: BugDraft }
  | { type: "assistant:text-delta"; messageId: string; delta: string }
  | { type: "assistant:message-completed"; messageId: string }
  | { type: "sdk:raw-message"; runId: string; message: unknown }
  | { type: "sdk:session-changed"; sessionId: string }
  | { type: "sdk:status"; status: string; raw?: unknown }
  | { type: "sdk:usage"; raw: unknown }
  | { type: "sdk:error"; message: string; retryable: boolean; raw?: unknown }
  | { type: "sdk:permission-denied"; toolName: string; raw?: unknown }
  | { type: "sdk:mcp-status"; servers: unknown[] }
  | { type: "sdk:task-progress"; taskId: string; summary?: string; raw?: unknown }
  | { type: "sdk:hook-event"; hookName: string; raw: unknown }
  | { type: "question:required"; requestId: string; questions: unknown[] }
  | { type: "question:answered"; requestId: string };

export function applyRunEvent(run: TestRun, event: RunEvent): TestRun {
  switch (event.type) {
    case "run:planning":
      return { ...run, status: "planning" };
    case "run:plan-ready":
      return { ...run, status: "waiting_confirmation", plan: event.plan };
    case "run:status-changed":
      return { ...run, status: event.status };
    case "tool:call-started": {
      const exists = run.toolCalls.some(tc => tc.id === event.toolCall.id);
      return {
        ...run,
        toolCalls: exists
          ? run.toolCalls.map(tc =>
              tc.id === event.toolCall.id ? { ...tc, status: "running" as const } : tc)
          : [...run.toolCalls, { ...event.toolCall, status: "running" as const }],
      };
    }
    case "tool:approval-required": {
      const exists = run.toolCalls.some(tc => tc.id === event.toolCall.id);
      return {
        ...run,
        status: "waiting_approval",
        toolCalls: exists
          ? run.toolCalls.map(tc =>
              tc.id === event.toolCall.id ? { ...tc, status: "waiting_approval" as const, approvalReason: event.toolCall.approvalReason } : tc)
          : [...run.toolCalls, { ...event.toolCall, status: "waiting_approval" as const }],
      };
    }
    case "tool:call-completed":
      return updateToolCall(run, event.toolCallId, {
        status: "completed",
        outputSummary: event.outputSummary,
      });
    case "tool:call-failed":
      return updateToolCall(run, event.toolCallId, {
        status: "failed",
        outputSummary: event.outputSummary,
      });
    case "evidence:created":
      return { ...run, evidence: [...run.evidence, event.evidence] };
    case "bug-draft:created":
      return { ...run, bugDraft: event.bugDraft };
    case "assistant:text-delta":
    case "assistant:message-completed":
    case "sdk:raw-message":
    case "sdk:session-changed":
    case "sdk:status":
    case "sdk:usage":
    case "sdk:error":
    case "sdk:permission-denied":
    case "sdk:mcp-status":
    case "sdk:task-progress":
    case "sdk:hook-event":
    case "question:required":
    case "question:answered":
      return run;
  }
}

function updateToolCall(
  run: TestRun,
  toolCallId: string,
  patch: Partial<ToolCall>,
): TestRun {
  return {
    ...run,
    toolCalls: run.toolCalls.map((toolCall) =>
      toolCall.id === toolCallId ? { ...toolCall, ...patch } : toolCall,
    ),
  };
}

export function createInitialRun(input: CreateInitialRunInput): TestRun {
  const prompt = input.prompt.trim();

  return {
    id: crypto.randomUUID(),
    title: prompt,
    userPrompt: prompt,
    status: "idle",
    projectName: input.projectName,
    environmentName: input.environmentName,
    agentName: input.agentName,
    plan: [],
    toolCalls: [],
    evidence: [],
  };
}
