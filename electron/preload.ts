// This file is compiled as CommonJS by tsconfig.preload.json
// because Electron sandboxed preload scripts do not support ESM imports.
// All logic is inlined because sandboxed preloads can only require("electron").
const { contextBridge, ipcRenderer } = require("electron");

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
  "settings:get", "settings:save",
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

if (typeof contextBridge !== "undefined") {
  contextBridge.exposeInMainWorld("aiTestAssistant", {
    send(channel: string, payload: unknown) {
      if (!rendererToMainChannels.includes(channel)) {
        throw new Error("Unsupported IPC channel: " + channel);
      }
      ipcRenderer.send(channel, payload);
    },
    invoke(channel: string, payload: unknown) {
      if (!rendererToMainChannels.includes(channel)) {
        throw new Error("Unsupported IPC channel: " + channel);
      }
      return ipcRenderer.invoke(channel, payload);
    },
    on(channel: string, listener: (payload: unknown) => void) {
      if (!mainToRendererChannels.includes(channel)) {
        throw new Error("Unsupported IPC channel: " + channel);
      }
      const wrapped = (_event: unknown, payload: unknown) => listener(payload);
      ipcRenderer.on(channel, wrapped);
      return () => {
        ipcRenderer.off(channel, wrapped);
      };
    },
  });
}
