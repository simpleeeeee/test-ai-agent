import { describe, expect, it } from "vitest";
import {
  isRendererToMainChannel,
  isMainToRendererChannel,
  rendererToMainChannels,
  mainToRendererChannels,
} from "./channels";

describe("IPC channels", () => {
  it("allows only explicit renderer-to-main channels", () => {
    expect(isRendererToMainChannel("run:create")).toBe(true);
    expect(isRendererToMainChannel("tool:approve")).toBe(true);
    expect(isRendererToMainChannel("settings:get")).toBe(true);
    expect(isRendererToMainChannel("shell:openExternal")).toBe(false);
  });

  it("allows only explicit main-to-renderer channels", () => {
    expect(isMainToRendererChannel("run:planning")).toBe(true);
    expect(isMainToRendererChannel("evidence:created")).toBe(true);
    expect(isMainToRendererChannel("shell:openExternal")).toBe(false);
    expect(isMainToRendererChannel("assistant:message-started")).toBe(true);
    expect(isMainToRendererChannel("tool:input-json-delta")).toBe(true);
    expect(isMainToRendererChannel("sdk:system-event")).toBe(true);
    expect(isMainToRendererChannel("sdk:token-counted" as any)).toBe(true);
  });

  it("rejects malformed or empty channel names", () => {
    expect(isRendererToMainChannel("")).toBe(false);
    expect(isRendererToMainChannel("random-string")).toBe(false);
  });

  it("contains every backend renderer-to-main action", () => {
    expect(rendererToMainChannels).toEqual([
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
      "settings:get",
      "settings:save",
      "window:minimize",
      "window:toggle-maximize",
      "window:close",
      "run:get-context-usage",
      "run:interrupt",
      "run:background-tasks",
      "run:read-file",
      "run:reload-plugins",
      "run:rewind-files",
      "run:seed-read-state",
      "run:get-subagent-messages",
      "run:list-subagents",
    ]);
  });

  it("allows renderer window control channels", () => {
    expect(isRendererToMainChannel("window:minimize")).toBe(true);
    expect(isRendererToMainChannel("window:toggle-maximize")).toBe(true);
    expect(isRendererToMainChannel("window:close")).toBe(true);
  });

  it("contains every backend main-to-renderer stream event", () => {
    expect(mainToRendererChannels).toEqual([
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
      "sdk:tool-progress",
      "sdk:tool-summary",
      "sdk:task-notification",
      "sdk:notification",
      "sdk:local-command-output",
      "sdk:plugin-install",
      "sdk:rate-limit",
      "sdk:files-persisted",
      "sdk:memory-recall",
      "sdk:mirror-error",
      "sdk:elicitation-complete",
      "sdk:user-message-replay",
      "sdk:compact-boundary",
      "sdk:deferred-tool-use",
      "sdk:token-counted",
      "question:required",
      "question:answered",
    ]);
  });
});
