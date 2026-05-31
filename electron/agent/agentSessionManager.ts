import type { MainToRendererChannel } from "../../src/ipc/channels.js";
import type { RunEvent } from "../../src/domain/testRun.js";
import { AsyncMessageQueue } from "./asyncMessageQueue.js";
import { ApprovalBridge } from "./approvalBridge.js";
import { ClaudeAgentRuntimeAdapter } from "./claudeAgentRuntimeAdapter.js";
import { loadAgentRuntimeConfig } from "./agentConfig.js";
import { SdkRunEventMapperSession } from "./runEventMapper.js";
import {
  listSessions as sdkListSessions,
  getSessionInfo as sdkGetSessionInfo,
  getSessionMessages as sdkGetSessionMessages,
  forkSession as sdkForkSession,
  renameSession as sdkRenameSession,
  tagSession as sdkTagSession,
  deleteSession as sdkDeleteSession,
  getSubagentMessages as sdkGetSubagentMessages,
  listSubagents as sdkListSubagents,
  type SDKSessionInfo,
  type SessionMessage,
} from "./claudeAgentSdkFacade.js";
import { loadClaudeCodeSettings } from "./sdkSettings.js";
import { buildSystemPrompt } from "./systemPromptBuilder.js";
import { createProcessManager, type ProcessState } from "./processManager.js";

const RETRYABLE_ERRORS = new Set([
  "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED",
  "socket hang up", "network error",
]);

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = typeof e.code === "string" ? e.code : undefined;
  if (code && RETRYABLE_ERRORS.has(code)) return true;
  const msg = typeof e.message === "string" ? e.message : String(e);
  for (const pattern of RETRYABLE_ERRORS) {
    if (msg.includes(pattern)) return true;
  }
  return false;
}

function errorMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
  processManager: ReturnType<typeof createProcessManager>;
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
    const config = await this.loadConfig({ cwd: this.deps.cwd ?? process.cwd(), claudeConfigDir: this.deps.configDir });
    if (config.degradations && config.degradations.length > 0) {
      this.deps.emit("sdk:system-event", {
        runId,
        subtype: "capability_degraded",
        raw: { model: config.model, degradations: config.degradations },
      });
    }
    const input = new AsyncMessageQueue<unknown>();
    const isResuming = !!(runOptions?.resume || runOptions?.continue);
    if (!isResuming) {
      input.push({ type: "user", message: { role: "user", content: prompt } });
    }

    const systemPrompt = buildSystemPrompt({
      staticParts: [
        "你是 AI 测试助手，帮助测试人员生成测试计划、执行测试、收集证据、生成缺陷草稿。",
        "请始终使用中文回复。",
      ],
      dynamicContext: {
        currentTime: new Date().toLocaleString("zh-CN"),
        userName: "测试员",
        projectName: "待定",
        environmentName: "待定",
        sessionId: runId,
      },
    });

    const finalOptions = {
      ...config.sdkOptions,
      systemPrompt: systemPrompt + (config.sdkOptions.systemPrompt ? "\n\n" + config.sdkOptions.systemPrompt : ""),
      ...(runOptions?.resume ? { resume: runOptions.resume } : {}),
      ...(runOptions?.continue ? { continue: true } : {}),
    };

    const approvalBridge = new ApprovalBridge(runId, (event) => this.emitRunEvent(runId, event));

    const processManager = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 1000,
      onStateChange: (state: ProcessState) => {
        this.deps.emit("sdk:system-event", {
          runId,
          subtype: "process_health",
          raw: {
            pid: state.pid,
            status: state.status,
            restartCount: state.restartCount,
            message: state.lastError ?? "",
          },
        });
      },
    });

    const session = this.adapter.start({
      prompt: input,
      options: finalOptions,
      canUseTool: approvalBridge.canUseTool,
    });

    this.runs.set(runId, { input, session, approvalBridge, processManager });
    await this.drainMessages(runId, session.messages);
  }

  approvePlan(runId: string) {
    this.run(runId).input.push({
      type: "user",
      message: { role: "user", content: "用户已确认计划，开始执行。" },
    });
  }

  sendMessage(runId: string, message: string) {
    this.run(runId).input.push({
      type: "user",
      message: { role: "user", content: message },
    });
  }

  stopRun(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.session.close();
    run.processManager.shutdown(5000).catch(() => { /* ignore shutdown errors */ });
    this.runs.delete(runId);
  }

  activeRunIds(): string[] {
    return Array.from(this.runs.keys());
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

  async accountInfo(runId: string) {
    const raw = await this.session(runId).accountInfo();
    const config = await this.loadConfig({ cwd: this.deps.cwd ?? process.cwd(), claudeConfigDir: this.deps.configDir });
    const env = (config.sdkOptions.env ?? {}) as Record<string, string>;
    return {
      endpoint: env.ANTHROPIC_BASE_URL ?? "",
      model: env.ANTHROPIC_MODEL ?? "",
      provider: "third_party",
      sdkApiProvider: (raw as any)?.apiProvider,
    };
  }

  async initializationResult(runId: string) {
    const settings = loadClaudeCodeSettings({ cwd: this.deps.cwd ?? process.cwd() });
    return {
      endpoint: settings.baseUrl,
      authenticated: !!settings.apiKey,
      model: settings.model,
      provider: "third_party",
    };
  }

  stopTask(runId: string, taskId: string) {
    return this.session(runId).stopTask(taskId);
  }

  // === Plan 2 新增: Query 方法委托 (7) ===
  getContextUsage(runId: string) {
    return this.session(runId).getContextUsage();
  }
  interrupt(runId: string) {
    return this.session(runId).interrupt();
  }
  backgroundTasks(runId: string, toolUseId?: string) {
    return this.session(runId).backgroundTasks(toolUseId);
  }
  readFile(runId: string, path: string, options?: { maxBytes?: number; encoding?: "utf-8" | "base64" }) {
    return this.session(runId).readFile(path, options);
  }
  reloadPlugins(runId: string) {
    return this.session(runId).reloadPlugins();
  }
  rewindFiles(runId: string, userMessageId: string, options?: { dryRun?: boolean }) {
    return this.session(runId).rewindFiles(userMessageId, options);
  }
  seedReadState(runId: string, path: string, mtime: number) {
    return this.session(runId).seedReadState(path, mtime);
  }

  // === Plan 2 新增: SDK 独立函数 (2) ===
  async getSubagentMessages(sessionId: string, agentId: string, options?: { limit?: number; offset?: number }) {
    return sdkGetSubagentMessages(sessionId, agentId, {
      dir: this.resolveDir(),
      ...options,
    });
  }
  async listSubagents(sessionId: string) {
    return sdkListSubagents(sessionId, { dir: this.resolveDir() });
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
    return this.startRun(runId, "", { resume: sessionId });
  }

  async forkSession(runId: string, sessionId: string) {
    const { sessionId: newSessionId } = await sdkForkSession(sessionId, {
      dir: this.resolveDir(),
    });
    if (this.runs.has(runId)) {
      this.stopRun(runId);
    }
    return this.startRun(runId, "", { resume: newSessionId });
  }

  async continueRun(runId: string) {
    return this.startRun(runId, "", { continue: true });
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

  private async drainMessages(runId: string, messages: AsyncIterable<unknown>, retries = 3, attempt = 1): Promise<void> {
    const mapper = new SdkRunEventMapperSession(runId);
    try {
      for await (const message of messages) {
        for (const event of mapper.map(message)) {
          this.emitRunEvent(runId, event);
        }
      }
    } catch (error) {
      if (isRetryable(error) && attempt <= retries) {
        this.deps.emit("sdk:system-event", {
          runId,
          subtype: "retry_attempt",
          raw: { attempt, retries, error: errorMsg(error) },
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 1000 * attempt));
        // Re-create the session messages stream via the existing run's session
        return this.drainMessages(runId, messages, retries, attempt + 1);
      }
      throw error;
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
