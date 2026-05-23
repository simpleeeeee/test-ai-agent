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
