import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from "./claudeAgentSdkFacade.js";

export type SystemPromptContext = {
  staticParts: string[];
  dynamicContext: {
    currentTime: string;
    userName: string;
    projectName: string;
    environmentName: string;
    sessionId: string;
  };
};

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const staticBlock = ctx.staticParts.join("\n\n");
  const dynamicBlock = [
    `当前时间：${ctx.dynamicContext.currentTime}`,
    `用户：${ctx.dynamicContext.userName}`,
    `项目：${ctx.dynamicContext.projectName}`,
    `测试环境：${ctx.dynamicContext.environmentName}`,
    `会话：${ctx.dynamicContext.sessionId}`,
  ].join("\n");

  return [staticBlock, SYSTEM_PROMPT_DYNAMIC_BOUNDARY, dynamicBlock].join("\n");
}
