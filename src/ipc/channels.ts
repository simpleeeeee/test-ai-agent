export const rendererToMainChannels = [
  "run:create",
  "run:approve-plan",
  "tool:approve",
  "tool:deny",
  "run:stop",
  "run:resume",
  "run:fork",
  "run:continue",
  "run:send-message",
  "run:set-model",
  "run:set-permission-mode",
  "run:apply-settings",
  "run:list-sessions",
  "run:get-session",
  "run:get-session-messages",
  "run:rename-session",
  "run:tag-session",
  "run:delete-session",
  "mcp:set-servers",
  "mcp:reconnect",
  "mcp:toggle",
  "mcp:status",
  "question:answer",
  "task:stop",
  "sdk:supported-models",
  "sdk:supported-commands",
  "sdk:supported-agents",
  "sdk:account-info",
  "sdk:initialization-result",
  "sdk:count-tokens",
  "settings:get",
  "settings:save",
  "window:minimize",
  "window:toggle-maximize",
  "window:close",
] as const;

export const mainToRendererChannels = [
  "run:created",
  "run:planning",
  "run:plan-ready",
  "run:status-changed",
  "tool:call-started",
  "tool:approval-required",
  "tool:call-completed",
  "tool:call-failed",
  "evidence:created",
  "bug-draft:created",
  "assistant:text-delta",
  "assistant:thinking-delta",
  "assistant:message-completed",
  "assistant:message-started",
  "tool:input-json-delta",
  "sdk:raw-message",
  "sdk:session-changed",
  "sdk:status",
  "sdk:usage",
  "sdk:error",
  "sdk:permission-denied",
  "sdk:mcp-status",
  "sdk:task-progress",
  "sdk:hook-event",
  "sdk:system-event",
  "sdk:token-counted",
  "question:required",
  "question:answered",
] as const;

export type RendererToMainChannel = (typeof rendererToMainChannels)[number];
export type MainToRendererChannel = (typeof mainToRendererChannels)[number];

export function isRendererToMainChannel(value: string): value is RendererToMainChannel {
  return rendererToMainChannels.includes(value as RendererToMainChannel);
}

export function isMainToRendererChannel(value: string): value is MainToRendererChannel {
  return mainToRendererChannels.includes(value as MainToRendererChannel);
}
