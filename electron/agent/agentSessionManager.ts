import type { MainToRendererChannel } from "../../src/ipc/channels.js";
import type { RunEvent } from "../../src/domain/testRun.js";
import { AsyncMessageQueue } from "./asyncMessageQueue.js";
import { ApprovalBridge } from "./approvalBridge.js";
import { ClaudeAgentRuntimeAdapter } from "./claudeAgentRuntimeAdapter.js";
import { loadAgentRuntimeConfig } from "./agentConfig.js";
import { mapSdkMessageToRunEvents } from "./runEventMapper.js";
import {
  listSessions as sdkListSessions,
  getSessionInfo as sdkGetSessionInfo,
  getSessionMessages as sdkGetSessionMessages,
  forkSession as sdkForkSession,
  renameSession as sdkRenameSession,
  tagSession as sdkTagSession,
  deleteSession as sdkDeleteSession,
  type SDKSessionInfo,
  type SessionMessage,
} from "./claudeAgentSdkFacade.js";

type RuntimeSession = ReturnType<ClaudeAgentRuntimeAdapter["start"]>;

type ManagerDeps = {
  adapter?: ClaudeAgentRuntimeAdapter;
  loadConfig?: typeof loadAgentRuntimeConfig;
  cwd?: string;
  configDir?: string | null;
  emit: (channel: MainToRendererChannel, payload: unknown) => void;
};

type ActiveRun = {
  input: AsyncMessageQueue<unknown>;
  session: RuntimeSession;
  approvalBridge: ApprovalBridge;
};

export class AgentSessionManager {
  private readonly adapter: ClaudeAgentRuntimeAdapter;
  private readonly loadConfig: typeof loadAgentRuntimeConfig;
  private readonly runs = new Map<string, ActiveRun>();

  constructor(private readonly deps: ManagerDeps) {
    this.adapter = deps.adapter ?? new ClaudeAgentRuntimeAdapter();
    this.loadConfig = deps.loadConfig ?? loadAgentRuntimeConfig;
  }

  async startRun(
    runId: string,
    prompt: string,
    runOptions?: { resume?: string; continue?: boolean },
  ) {
    const config = this.loadConfig({ cwd: this.deps.cwd ?? process.cwd(), claudeConfigDir: this.deps.configDir });
    const input = new AsyncMessageQueue<unknown>();
    input.push({ type: "user", message: { role: "user", content: prompt } });

    const approvalBridge = new ApprovalBridge(runId, (event) => this.emitRunEvent(runId, event));
    const session = this.adapter.start({
      prompt: input,
      options: {
        ...config.sdkOptions,
        ...(runOptions?.resume ? { resume: runOptions.resume } : {}),
        ...(runOptions?.continue ? { continue: true } : {}),
      },
      canUseTool: approvalBridge.canUseTool,
    });

    this.runs.set(runId, { input, session, approvalBridge });
    await this.drainMessages(runId, session.messages);
  }

  approvePlan(runId: string) {
    this.session(runId).streamInput({
      type: "user",
      message: { role: "user", content: "用户已确认计划，开始执行。" },
    });
  }

  sendMessage(runId: string, message: string) {
    this.session(runId).streamInput({
      type: "user",
      message: { role: "user", content: message },
    });
  }

  stopRun(runId: string) {
    this.session(runId).close();
    this.runs.delete(runId);
  }

  approveTool(runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) {
    this.run(runId).approvalBridge.approve(requestId, options);
  }

  denyTool(runId: string, requestId: string, message?: string) {
    this.run(runId).approvalBridge.deny(requestId, message);
  }

  answerQuestion(runId: string, requestId: string, answers: Record<string, unknown>) {
    this.run(runId).approvalBridge.answerQuestion(requestId, answers);
  }

  setModel(runId: string, model: string) {
    return this.session(runId).setModel(model);
  }

  setPermissionMode(runId: string, mode: string) {
    return this.session(runId).setPermissionMode(mode);
  }

  applySettings(runId: string, settings: Record<string, unknown>) {
    return this.session(runId).applyFlagSettings(settings);
  }

  mcpStatus(runId: string) {
    return this.session(runId).mcpServerStatus();
  }

  setMcpServers(runId: string, servers: Record<string, unknown>) {
    return this.session(runId).setMcpServers(servers);
  }

  reconnectMcpServer(runId: string, serverName: string) {
    return this.session(runId).reconnectMcpServer(serverName);
  }

  toggleMcpServer(runId: string, serverName: string, enabled: boolean) {
    return this.session(runId).toggleMcpServer(serverName, enabled);
  }

  supportedCommands(runId: string) {
    return this.session(runId).supportedCommands();
  }

  supportedModels(runId: string) {
    return this.session(runId).supportedModels();
  }

  supportedAgents(runId: string) {
    return this.session(runId).supportedAgents();
  }

  accountInfo(runId: string) {
    return this.session(runId).accountInfo();
  }

  initializationResult(runId: string) {
    return this.session(runId).initializationResult();
  }

  stopTask(runId: string, taskId: string) {
    return this.session(runId).stopTask(taskId);
  }

  async listSessions(): Promise<SDKSessionInfo[]> {
    return sdkListSessions({ dir: this.resolveDir() });
  }

  async getSession(sessionId: string): Promise<SDKSessionInfo | null> {
    const info = await sdkGetSessionInfo(sessionId, { dir: this.resolveDir() });
    return info ?? null;
  }

  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    return sdkGetSessionMessages(sessionId, { dir: this.resolveDir() });
  }

  async resumeSession(runId: string, sessionId: string) {
    if (this.runs.has(runId)) {
      this.stopRun(runId);
    }
    return this.startRun(runId, "恢复之前的会话", { resume: sessionId });
  }

  async forkSession(runId: string, sessionId: string) {
    const { sessionId: newSessionId } = await sdkForkSession(sessionId, {
      dir: this.resolveDir(),
    });
    if (this.runs.has(runId)) {
      this.stopRun(runId);
    }
    return this.startRun(runId, "从会话分支继续执行", { resume: newSessionId });
  }

  async continueRun(runId: string) {
    return this.startRun(runId, "继续执行", { continue: true });
  }

  async renameSession(sessionId: string, title: string) {
    await sdkRenameSession(sessionId, title, { dir: this.resolveDir() });
  }

  async tagSession(sessionId: string, tag: string | null) {
    await sdkTagSession(sessionId, tag, { dir: this.resolveDir() });
  }

  async deleteSession(sessionId: string) {
    await sdkDeleteSession(sessionId, { dir: this.resolveDir() });
  }

  private resolveDir(): string {
    return this.deps.cwd ?? process.cwd();
  }

  private async drainMessages(runId: string, messages: AsyncIterable<unknown>) {
    let assistantMessageId: string | undefined;
    for await (const message of messages) {
      if (isAssistantMessageStart(message)) {
        assistantMessageId = (message as any).event.message.id as string;
      }
      for (const event of mapSdkMessageToRunEvents(runId, message, assistantMessageId)) {
        this.emitRunEvent(runId, event);
      }
    }
  }

  private emitRunEvent(runId: string, event: RunEvent) {
    this.deps.emit(event.type as MainToRendererChannel, { runId, ...event });
  }

  private run(runId: string): ActiveRun {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Unknown run: ${runId}`);
    }
    return run;
  }

  private session(runId: string): RuntimeSession {
    return this.run(runId).session;
  }
}

function isAssistantMessageStart(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const m = message as Record<string, unknown>;
  return m.type === "stream_event"
    && m.event != null
    && typeof m.event === "object"
    && (m.event as Record<string, unknown>).type === "message_start";
}
