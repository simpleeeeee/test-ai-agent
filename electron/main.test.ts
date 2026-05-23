import { describe, expect, it, vi } from "vitest";

const handle = vi.fn();
const on = vi.fn();
const send = vi.fn();

vi.mock("electron", () => ({
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn(function BrowserWindow() {
    return {
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      webContents: { send },
    };
  }),
  ipcMain: { handle, on },
}));

const sessionManager = {
  startRun: vi.fn(),
  approvePlan: vi.fn(),
  sendMessage: vi.fn(),
  stopRun: vi.fn(),
  approveTool: vi.fn(),
  denyTool: vi.fn(),
  answerQuestion: vi.fn(),
  setModel: vi.fn(),
  setPermissionMode: vi.fn(),
  applySettings: vi.fn(),
  mcpStatus: vi.fn(),
  setMcpServers: vi.fn(),
  reconnectMcpServer: vi.fn(),
  toggleMcpServer: vi.fn(),
  supportedCommands: vi.fn(),
  supportedModels: vi.fn(),
  supportedAgents: vi.fn(),
  accountInfo: vi.fn(),
  initializationResult: vi.fn(),
  stopTask: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  resumeSession: vi.fn(),
  forkSession: vi.fn(),
  continueRun: vi.fn(),
  renameSession: vi.fn(),
  tagSession: vi.fn(),
  deleteSession: vi.fn(),
};

vi.mock("./agent/backendRuntime.js", () => ({
  createBackendRuntime: vi.fn(() => ({
    sessionManager,
    emit: vi.fn(),
  })),
}));

describe("electron main IPC registration", () => {
  it("registers supported invoke handlers", async () => {
    await import("./main.js");

    const handledChannels = handle.mock.calls.map(([channel]) => channel);

    expect(handledChannels.sort()).toEqual([
      "mcp:reconnect",
      "mcp:set-servers",
      "mcp:status",
      "mcp:toggle",
      "run:apply-settings",
      "run:continue",
      "run:delete-session",
      "run:fork",
      "run:get-session",
      "run:list-sessions",
      "run:rename-session",
      "run:resume",
      "run:set-model",
      "run:set-permission-mode",
      "run:tag-session",
      "sdk:account-info",
      "sdk:initialization-result",
      "sdk:supported-agents",
      "sdk:supported-commands",
      "sdk:supported-models",
      "task:stop",
    ]);
  });

  it("registers supported send handlers", async () => {
    await import("./main.js");

    const onChannels = on.mock.calls.map(([channel]) => channel);

    expect(onChannels.sort()).toEqual([
      "question:answer",
      "run:approve-plan",
      "run:create",
      "run:send-message",
      "run:stop",
      "tool:approve",
      "tool:deny",
    ]);
  });
});
