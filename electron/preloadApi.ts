const rendererToMainChannels = [
  "run:create", "run:approve-plan", "tool:approve", "tool:deny",
  "run:stop", "run:resume", "run:fork", "run:continue",
  "run:send-message", "run:set-model", "run:set-permission-mode",
  "run:apply-settings", "run:list-sessions", "run:get-session",
  "run:rename-session", "run:tag-session", "run:delete-session",
  "mcp:set-servers", "mcp:reconnect", "mcp:toggle", "mcp:status",
  "question:answer", "task:stop",
  "sdk:supported-models", "sdk:supported-commands", "sdk:supported-agents",
  "sdk:account-info", "sdk:initialization-result",
  "window:minimize", "window:toggle-maximize", "window:close",
];

const mainToRendererChannels = [
  "run:created", "run:planning", "run:plan-ready", "run:status-changed",
  "tool:call-started", "tool:approval-required", "tool:call-completed",
  "tool:call-failed", "evidence:created", "bug-draft:created",
  "assistant:text-delta", "assistant:message-completed",
  "sdk:raw-message", "sdk:session-changed", "sdk:status", "sdk:usage",
  "sdk:error", "sdk:permission-denied", "sdk:mcp-status",
  "sdk:task-progress", "sdk:hook-event",
  "question:required", "question:answered",
];

export function isRendererToMainChannel(value: string): boolean {
  return rendererToMainChannels.includes(value);
}

export function isMainToRendererChannel(value: string): boolean {
  return mainToRendererChannels.includes(value);
}

export type IpcSender = {
  send: (channel: string, payload: unknown) => void;
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
  on: (channel: string, listener: (event: unknown, payload: unknown) => void) => void;
  off: (channel: string, listener: (event: unknown, payload: unknown) => void) => void;
};

export function createSafeIpcApi(sender: IpcSender) {
  return {
    send(channel: string, payload: unknown) {
      if (!isRendererToMainChannel(channel)) {
        throw new Error("Unsupported IPC channel: " + channel);
      }
      sender.send(channel, payload);
    },
    invoke(channel: string, payload: unknown) {
      if (!isRendererToMainChannel(channel)) {
        throw new Error("Unsupported IPC channel: " + channel);
      }
      return sender.invoke(channel, payload);
    },
    on(channel: string, listener: (payload: unknown) => void) {
      if (!isMainToRendererChannel(channel)) {
        throw new Error("Unsupported IPC channel: " + channel);
      }
      const wrapped = (_event: unknown, payload: unknown) => listener(payload);
      sender.on(channel, wrapped);
      return () => {
        sender.off(channel, wrapped);
      };
    },
  };
}
