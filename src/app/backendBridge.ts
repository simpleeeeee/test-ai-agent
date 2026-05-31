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
  "sdk:connection-status",
  "sdk:deferred-tool-use",
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
    applySettings(runId: string, settings: Record<string, unknown> & {
      outputFormat?: {
        type: "json_schema";
        json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
      };
    }) {
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
      return api.invoke("settings:get", undefined) as Promise<{
        baseUrl: string;
        apiKey: string;
        model: string;
        effort?: string;
        sandboxEnabled?: boolean;
        promptCaching?: boolean;
        debug?: boolean;
        debugFile?: string;
        maxBudgetUsd?: number;
        maxTurns?: number;
        outputFormat?: { template?: string; customSchema?: string | null };
      }>;
    },
    saveSettings(settings: {
      baseUrl: string;
      apiKey: string;
      model: string;
      effort?: string;
      sandboxEnabled?: boolean;
      promptCaching?: boolean;
      debug?: boolean;
      debugFile?: string;
      maxBudgetUsd?: number;
      maxTurns?: number;
      outputFormat?: { template?: string; customSchema?: string | null };
    }) {
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
    getContextUsage(runId: string) { return api.invoke("run:get-context-usage", { runId }); },
    interrupt(runId: string) { return api.invoke("run:interrupt", { runId }); },
    backgroundTasks(runId: string, toolUseId?: string) { return api.invoke("run:background-tasks", { runId, toolUseId }); },
    readFile(runId: string, path: string, options?: { maxBytes?: number; encoding?: "utf-8" | "base64" }) { return api.invoke("run:read-file", { runId, path, ...options }); },
    reloadPlugins(runId: string) { return api.invoke("run:reload-plugins", { runId }); },
    rewindFiles(runId: string, userMessageId: string, options?: { dryRun?: boolean }) { return api.invoke("run:rewind-files", { runId, userMessageId, ...options }); },
    seedReadState(runId: string, path: string, mtime: number) { return api.invoke("run:seed-read-state", { runId, path, mtime }); },
    getSubagentMessages(runId: string, sessionId: string, agentId: string, options?: { limit?: number; offset?: number }) { return api.invoke("run:get-subagent-messages", { runId, sessionId, agentId, ...options }); },
    listSubagents(runId: string, sessionId: string) { return api.invoke("run:list-subagents", { runId, sessionId }); },
  };
}

export type BackendBridge = ReturnType<typeof createBackendBridge>;
