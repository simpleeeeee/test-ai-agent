export { foldSessionSummary } from "@anthropic-ai/claude-agent-sdk";
export * from "@anthropic-ai/claude-agent-sdk";
export {
  createSdkMcpServer,
  tool,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
} from "@anthropic-ai/claude-agent-sdk";

export async function countPromptTokens(): Promise<{ inputTokens: number }> {
  throw new Error("countTokens is not available in the installed Claude Agent SDK version");
}
