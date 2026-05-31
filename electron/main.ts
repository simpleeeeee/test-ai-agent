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
import { resolveClaudeConfigDir } from "./agent/claudeConfigDir.js";
import { startup } from "./agent/claudeAgentSdkFacade.js";
import { ensureClaudeCodeSettings, loadClaudeCodeSettings, saveClaudeCodeSettings } from "./agent/sdkSettings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sendToRenderer(window: BrowserWindow, channel: MainToRendererChannel, payload: unknown) {
  if (!isMainToRendererChannel(channel)) {
    console.warn(`Blocked main→renderer channel: ${channel}`);
    return;
  }
  window.webContents.send(channel, payload);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function runIdFromPayload(payload: unknown) {
  return payload && typeof payload === "object" && "runId" in payload && typeof payload.runId === "string"
    ? payload.runId
    : undefined;
}

function sendIpcError(window: BrowserWindow, error: unknown, payload?: unknown) {
  sendToRenderer(window, "sdk:error", {
    runId: runIdFromPayload(payload),
    message: errorMessage(error),
    retryable: true,
  });
}

function appBaseDirectory() {
  return app.isPackaged ? path.dirname(app.getPath("exe")) : process.cwd();
}

function registerBackendIpc(window: BrowserWindow, cwd: string, configDir: string | null) {
  const runtime = createBackendRuntime({
    cwd,
    configDir,
    send: (channel, payload) => sendToRenderer(window, channel, payload),
  });
  const manager = runtime.sessionManager;

  const onRequest = (
    channel: RendererToMainChannel,
    handler: (payload: any) => void | Promise<void>,
  ) => {
    ipcMain.on(channel, (_event, payload) => {
      let parsed: unknown;
      try {
        parsed = parseRendererToMainPayload(channel, payload);
      } catch (error) {
        sendIpcError(window, error, payload);
        return;
      }

      void Promise.resolve(handler(parsed)).catch((error) => {
        sendIpcError(window, error, parsed);
      });
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
  handleRequest("settings:get", () => loadClaudeCodeSettings({ cwd }));
  handleRequest("settings:save", ({ baseUrl, apiKey, model }) => {
    saveClaudeCodeSettings({ cwd, baseUrl, apiKey, model });
    return loadClaudeCodeSettings({ cwd });
  });
  handleRequest("task:stop", ({ runId, taskId }) => manager.stopTask(runId, taskId));
  handleRequest("run:list-sessions", () =>
    manager.listSessions().catch((e) => {
      console.error("listSessions failed:", e);
      return [];
    })
  );
  handleRequest("run:get-session", ({ sessionId }) =>
    manager.getSession(sessionId).catch((e) => {
      console.error("getSession failed:", e);
      return null;
    })
  );
  handleRequest("run:get-session-messages", ({ sessionId }) =>
    manager.getSessionMessages(sessionId).catch((e) => {
      console.error("getSessionMessages failed:", e);
      return [];
    })
  );
  handleRequest("run:resume", ({ runId, sessionId }) =>
    manager.resumeSession(runId, sessionId).catch((e) => ({ error: errorMessage(e), code: "SDK_ERROR" }))
  );
  handleRequest("run:fork", ({ runId, sessionId }) =>
    manager.forkSession(runId, sessionId).catch((e) => ({ error: errorMessage(e), code: "SDK_ERROR" }))
  );
  handleRequest("run:continue", ({ runId }) =>
    manager.continueRun(runId).catch((e) => ({ error: errorMessage(e), code: "SDK_ERROR" }))
  );
  handleRequest("run:rename-session", ({ sessionId, title }) =>
    manager.renameSession(sessionId, title).catch((e) => ({ error: errorMessage(e), code: "SDK_ERROR" }))
  );
  handleRequest("run:tag-session", ({ sessionId, tag }) =>
    manager.tagSession(sessionId, tag).catch((e) => ({ error: errorMessage(e), code: "SDK_ERROR" }))
  );
  handleRequest("run:delete-session", ({ sessionId }) =>
    manager.deleteSession(sessionId).catch((e) => ({ error: errorMessage(e), code: "SDK_ERROR" }))
  );
  handleRequest("run:get-context-usage", ({ runId }) => manager.getContextUsage(runId));
  handleRequest("run:interrupt", ({ runId }) => manager.interrupt(runId));
  handleRequest("run:background-tasks", ({ runId, toolUseId }) => manager.backgroundTasks(runId, toolUseId));
  handleRequest("run:read-file", ({ runId, path, maxBytes, encoding }) => manager.readFile(runId, path, { maxBytes, encoding }));
  handleRequest("run:reload-plugins", ({ runId }) => manager.reloadPlugins(runId));
  handleRequest("run:rewind-files", ({ runId, userMessageId, dryRun }) => manager.rewindFiles(runId, userMessageId, { dryRun }));
  handleRequest("run:seed-read-state", ({ runId, path, mtime }) => manager.seedReadState(runId, path, mtime));
  handleRequest("run:get-subagent-messages", ({ runId, sessionId, agentId, limit, offset }) => manager.getSubagentMessages(sessionId, agentId, { limit, offset }));
  handleRequest("run:list-subagents", ({ runId, sessionId }) => manager.listSubagents(sessionId));
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
  const cwd = appBaseDirectory();
  const configDir = resolveClaudeConfigDir({ appDir: cwd, isPackaged: app.isPackaged });
  ensureClaudeCodeSettings({ cwd });

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

  registerBackendIpc(window, cwd, configDir);

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

startup().then((warmQuery) => {
  app.on("will-quit", () => { warmQuery[Symbol.asyncDispose](); });
}).catch((e) => {
  console.warn("SDK startup 预热失败:", e);
});

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

export { appBaseDirectory, registerBackendIpc, sendToRenderer };
