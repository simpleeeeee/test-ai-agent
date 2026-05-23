export const rendererToMainChannels = [
  "run:create",
  "run:approve-plan",
  "run:revise-plan",
  "tool:approve",
  "tool:deny",
  "run:stop",
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
] as const;

export type RendererToMainChannel = (typeof rendererToMainChannels)[number];
export type MainToRendererChannel = (typeof mainToRendererChannels)[number];

export function isRendererToMainChannel(value: string): value is RendererToMainChannel {
  return rendererToMainChannels.includes(value as RendererToMainChannel);
}
