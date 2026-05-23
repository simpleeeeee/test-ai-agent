export type TestRunStatus = "idle";

export interface CreateInitialRunInput {
  prompt: string;
  projectName: string;
  environmentName: string;
  agentName: string;
}

export interface TestRun {
  title: string;
  status: TestRunStatus;
  userPrompt: string;
  projectName: string;
  environmentName: string;
  agentName: string;
  plan: string[];
  toolCalls: string[];
  evidence: string[];
}

export function createInitialRun(input: CreateInitialRunInput): TestRun {
  return {
    title: input.prompt,
    status: "idle",
    userPrompt: input.prompt,
    projectName: input.projectName,
    environmentName: input.environmentName,
    agentName: input.agentName,
    plan: [],
    toolCalls: [],
    evidence: [],
  };
}
