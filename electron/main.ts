import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isMainToRendererChannel,
  isRendererToMainChannel,
  type MainToRendererChannel,
  type RendererToMainChannel,
} from "../src/ipc/channels.js";
import { parseRendererToMainPayload } from "../src/ipc/payloadSchemas.js";
import { createBackendRuntime } from "./agent/backendRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sendToRenderer(window: BrowserWindow, channel: MainToRendererChannel, payload: unknown) {
  if (!isMainToRendererChannel(channel)) {
    console.warn(`Blocked main→renderer channel: ${channel}`);
    return;
  }
  window.webContents.send(channel, payload);
}

function registerBackendIpc(window: BrowserWindow) {
  const runtime = createBackendRuntime({
    send: (channel, payload) => sendToRenderer(window, channel, payload),
  });
  const manager = runtime.sessionManager;

  const onRequest = (
    channel: RendererToMainChannel,
    handler: (payload: any) => void | Promise<void>,
  ) => {
    ipcMain.on(channel, (_event, payload) => {
      const parsed = parseRendererToMainPayload(channel, payload);
      void handler(parsed);
    });
  };

  const handleRequest = (
    channel: RendererToMainChannel,
    handler: (payload: any) => unknown | Promise<unknown>,
  ) => {
    ipcMain.handle(channel, (_event, payload) => {
      const parsed = parseRendererToMainPayload(channel, payload);
      return handler(parsed);
    });
  };

  onRequest("run:create", ({ prompt }) => manager.startRun(crypto.randomUUID(), prompt));
  onRequest("run:approve-plan", ({ runId }) => manager.approvePlan(runId));
  onRequest("run:send-message", ({ runId, message }) => manager.sendMessage(runId, message));
  onRequest("run:stop", ({ runId }) => manager.stopRun(runId));
  onRequest("tool:approve", ({ runId, requestId, updatedInput, applyPermissionSuggestions }) =>
    manager.approveTool(runId, requestId, { updatedInput, applyPermissionSuggestions }));
  onRequest("tool:deny", ({ runId, requestId, message }) => manager.denyTool(runId, requestId, message));
  onRequest("question:answer", ({ runId, requestId, answers }) => manager.answerQuestion(runId, requestId, answers));

  handleRequest("run:set-model", ({ runId, model }) => manager.setModel(runId, model));
  handleRequest("run:set-permission-mode", ({ runId, permissionMode }) => manager.setPermissionMode(runId, permissionMode));
  handleRequest("run:apply-settings", ({ runId, settings }) => manager.applySettings(runId, settings));
  handleRequest("mcp:status", ({ runId }) => manager.mcpStatus(runId));
  handleRequest("mcp:set-servers", ({ runId, servers }) => manager.setMcpServers(runId, servers));
  handleRequest("mcp:reconnect", ({ runId, serverName }) => manager.reconnectMcpServer(runId, serverName));
  handleRequest("mcp:toggle", ({ runId, serverName, enabled }) => manager.toggleMcpServer(runId, serverName, enabled));
  handleRequest("sdk:supported-commands", ({ runId }) => manager.supportedCommands(runId));
  handleRequest("sdk:supported-models", ({ runId }) => manager.supportedModels(runId));
  handleRequest("sdk:supported-agents", ({ runId }) => manager.supportedAgents(runId));
  handleRequest("sdk:account-info", ({ runId }) => manager.accountInfo(runId));
  handleRequest("sdk:initialization-result", ({ runId }) => manager.initializationResult(runId));
  handleRequest("task:stop", ({ runId, taskId }) => manager.stopTask(runId, taskId));
  handleRequest("run:list-sessions", () => manager.listSessions());
  handleRequest("run:get-session", ({ sessionId }) => manager.getSession(sessionId));
  handleRequest("run:resume", ({ runId, sessionId }) => manager.resumeSession(runId, sessionId));
  handleRequest("run:fork", ({ runId, sessionId }) => manager.forkSession(runId, sessionId));
  handleRequest("run:continue", ({ runId }) => manager.continueRun(runId));
  handleRequest("run:rename-session", ({ sessionId, title }) => manager.renameSession(sessionId, title));
  handleRequest("run:tag-session", ({ sessionId, tag }) => manager.tagSession(sessionId, tag));
  handleRequest("run:delete-session", ({ sessionId }) => manager.deleteSession(sessionId));
}

function focusedWindow() {
  return BrowserWindow.getFocusedWindow();
}

function registerWindowControlIpc() {
  ipcMain.on("window:minimize", () => {
    focusedWindow()?.minimize();
  });

  ipcMain.on("window:toggle-maximize", () => {
    const window = focusedWindow();
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on("window:close", () => {
    focusedWindow()?.close();
  });
}

async function createWindow() {
  Menu.setApplicationMenu(null);
  registerWindowControlIpc();

  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "AI 测试助手",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  registerBackendIpc(window);

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

export { registerBackendIpc, sendToRenderer };
