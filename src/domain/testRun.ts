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
  | { type: "bug-draft:created"; bugDraft: BugDraft };

export function applyRunEvent(run: TestRun, event: RunEvent): TestRun {
  switch (event.type) {
    case "run:planning":
      return { ...run, status: "planning" };
    case "run:plan-ready":
      return { ...run, status: "waiting_confirmation", plan: event.plan };
    case "run:status-changed":
      return { ...run, status: event.status };
    case "tool:call-started":
      return { ...run, toolCalls: [...run.toolCalls, event.toolCall] };
    case "tool:approval-required":
      return {
        ...run,
        status: "waiting_approval",
        toolCalls: [...run.toolCalls, { ...event.toolCall, status: "waiting_approval" }],
      };
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
