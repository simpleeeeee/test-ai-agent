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

    expect(handledChannels).toEqual(expect.arrayContaining([
      "sdk:supported-models",
      "mcp:status",
      "run:set-model",
      "task:stop",
    ]));
  });

  it("registers supported send handlers", async () => {
    await import("./main.js");

    const onChannels = on.mock.calls.map(([channel]) => channel);

    expect(onChannels).toEqual(expect.arrayContaining([
      "run:create",
      "run:approve-plan",
      "tool:approve",
      "tool:deny",
      "question:answer",
      "run:stop",
    ]));
  });
});
