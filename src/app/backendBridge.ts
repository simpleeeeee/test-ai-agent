import type { MainToRendererChannel, RendererToMainChannel } from "../ipc/channels";

export type RendererEventEnvelope = {
  channel: MainToRendererChannel;
  payload: unknown;
};

export type AiTestAssistantApi = {
  send: (channel: RendererToMainChannel, payload?: unknown) => void;
  invoke: (channel: RendererToMainChannel, payload?: unknown) => Promise<unknown>;
  on: (channel: MainToRendererChannel, listener: (payload: unknown) => void) => () => void;
};

const streamChannels: MainToRendererChannel[] = [
  "run:created",
  "run:planning",
  "run:plan-ready",
  "run:status-changed",
  "tool:call-started",
  "tool:approval-required",
  "tool:call-completed",
  "tool:call-failed",
  "tool:input-json-delta",
  "evidence:created",
  "bug-draft:created",
  "assistant:text-delta",
  "assistant:thinking-delta",
  "assistant:message-started",
  "assistant:message-completed",
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
];

export function createBackendBridge(api: AiTestAssistantApi) {
  return {
    createRun(prompt: string) {
      api.send("run:create", { prompt });
    },
    approvePlan(runId: string) {
      api.send("run:approve-plan", { runId });
    },
    sendMessage(runId: string, message: string) {
      api.send("run:send-message", { runId, message });
    },
    stopRun(runId: string) {
      api.send("run:stop", { runId });
    },
    approveTool(runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) {
      api.send("tool:approve", { runId, requestId, ...options });
    },
    denyTool(runId: string, requestId: string, message?: string) {
      api.send("tool:deny", { runId, requestId, message });
    },
    answerQuestion(runId: string, requestId: string, answers: Record<string, unknown>) {
      api.send("question:answer", { runId, requestId, answers });
    },
    setModel(runId: string, model: string) {
      return api.invoke("run:set-model", { runId, model });
    },
    setPermissionMode(runId: string, permissionMode: string) {
      return api.invoke("run:set-permission-mode", { runId, permissionMode });
    },
    applySettings(runId: string, settings: Record<string, unknown>) {
      return api.invoke("run:apply-settings", { runId, settings });
    },
    mcpStatus(runId: string) {
      return api.invoke("mcp:status", { runId });
    },
    setMcpServers(runId: string, servers: Record<string, unknown>) {
      return api.invoke("mcp:set-servers", { runId, servers });
    },
    reconnectMcpServer(runId: string, serverName: string) {
      return api.invoke("mcp:reconnect", { runId, serverName });
    },
    toggleMcpServer(runId: string, serverName: string, enabled: boolean) {
      return api.invoke("mcp:toggle", { runId, serverName, enabled });
    },
    supportedModels(runId: string) {
      return api.invoke("sdk:supported-models", { runId });
    },
    supportedCommands(runId: string) {
      return api.invoke("sdk:supported-commands", { runId });
    },
    supportedAgents(runId: string) {
      return api.invoke("sdk:supported-agents", { runId });
    },
    accountInfo(runId: string) {
      return api.invoke("sdk:account-info", { runId });
    },
    initializationResult(runId: string) {
      return api.invoke("sdk:initialization-result", { runId });
    },
    stopTask(runId: string, taskId: string) {
      return api.invoke("task:stop", { runId, taskId });
    },
    loadSettings() {
      return api.invoke("settings:get", undefined) as Promise<{ baseUrl: string; apiKey: string; model: string }>;
    },
    saveSettings(settings: { baseUrl: string; apiKey: string; model: string }) {
      return api.invoke("settings:save", settings);
    },
    listSessions() {
      return api.invoke("run:list-sessions", undefined);
    },
    getSession(sessionId: string) {
      return api.invoke("run:get-session", { sessionId });
    },
    getSessionMessages(sessionId: string) {
      return api.invoke("run:get-session-messages", { sessionId });
    },
    resumeSession(runId: string, sessionId: string) {
      return api.invoke("run:resume", { runId, sessionId });
    },
    forkSession(runId: string, sessionId: string) {
      return api.invoke("run:fork", { runId, sessionId });
    },
    continueRun(runId: string) {
      return api.invoke("run:continue", { runId });
    },
    renameSession(sessionId: string, title: string) {
      return api.invoke("run:rename-session", { sessionId, title });
    },
    tagSession(sessionId: string, tag: string) {
      return api.invoke("run:tag-session", { sessionId, tag });
    },
    deleteSession(sessionId: string) {
      return api.invoke("run:delete-session", { sessionId });
    },
    subscribe(listener: (event: RendererEventEnvelope) => void) {
      const cleanups = streamChannels.map((channel) => api.on(channel, (payload) => listener({ channel, payload })));
      return () => cleanups.forEach((cleanup) => cleanup());
    },
    minimizeWindow() {
      api.send("window:minimize", undefined);
    },
    toggleMaximizeWindow() {
      api.send("window:toggle-maximize", undefined);
    },
    closeWindow() {
      api.send("window:close", undefined);
    },
  };
}

export type BackendBridge = ReturnType<typeof createBackendBridge>;
