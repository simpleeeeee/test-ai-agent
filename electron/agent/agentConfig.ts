import fs from "node:fs";
import path from "node:path";
import { loadClaudeCodeSettings, loadResolvedSettings } from "./sdkSettings.js";
// 以下类型按需从 facade 导入；若因版本差异导致导入失败（循环依赖或类型缺失），可降级为 any
import type { OnElicitation, SpawnOptions, SpawnedProcess } from "./claudeAgentSdkFacade.js";
import { customTools } from "./customTools.js";
import { appMcpServer } from "./appMcpServer.js";
import { detectModelCapabilities } from "./modelCapabilities.js";
import type { ModelCapabilities } from "./modelCapabilities.js";

export type AgentRuntimeConfig = {
  cwd: string;
  sdkOptions: Record<string, unknown>;
};

type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | "auto";
type ThinkingEffort = "low" | "medium" | "high" | "xhigh" | "max";
type ThinkingDisplay = "summarized" | "omitted";
type Executable = "bun" | "deno" | "node";
type SessionStoreFlushValue = "batched" | "eager";
type SettingSourceValue = "user" | "project" | "local";

export type { Executable, SessionStoreFlushValue, SettingSourceValue };

export type UserSdkOptions = {
  permissionMode?: PermissionMode;
  maxTurns?: number;
  max_budget_usd?: number;
  enableFileCheckpointing?: boolean;
  fallback_model?: string;
  additionalDirectories?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  agents?: Record<string, unknown>;
  skills?: Record<string, unknown> | string[];
  hooks?: Record<string, unknown>;
  tools?: unknown[];
  mcpServers?: Record<string, unknown>;
  systemPrompt?: string;
  thinking?: { effort?: ThinkingEffort; display?: ThinkingDisplay };
  toolChoice?: unknown;
  outputConfig?: unknown;
  contextEditing?: unknown;
  compaction?: unknown;
  promptCaching?: unknown;
  // ===== A 组：白名单 Set 校验（新增）=====
  effort?: ThinkingEffort;
  executable?: Executable;
  sessionStoreFlush?: SessionStoreFlushValue;
  betas?: string[];
  settingSources?: SettingSourceValue[];
  // ===== B 组和 C 组字段先声明类型但暂不实现校验 =====
  title?: string;
  debug?: boolean;
  debugFile?: string;
  strictMcpConfig?: boolean;
  persistSession?: boolean;
  includeHookEvents?: boolean;
  forwardSubagentText?: boolean;
  promptSuggestions?: boolean;
  agentProgressSummaries?: boolean;
  allowDangerouslySkipPermissions?: boolean;
  planModeInstructions?: string;
  permissionPromptToolName?: string;
  toolConfig?: { askUserQuestion?: { previewFormat?: "markdown" | "html" } };
  sandbox?: { enabled?: boolean; network?: unknown; filesystem?: unknown; [k: string]: unknown };
  plugins?: Array<{ type: "local"; path: string; [k: string]: unknown }>;
  managedSettings?: Record<string, unknown>;
  settings?: string | Record<string, unknown>;
  toolAliases?: Record<string, string>;
  agent?: string;
  extraArgs?: Record<string, string | null>;
  executableArgs?: string[];
  resumeSessionAt?: string;
  outputFormat?: {
    type: "json_schema";
    json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
  };
};

const permissionModes = new Set(["default", "acceptEdits", "bypassPermissions", "plan", "dontAsk", "auto"]);
const thinkingEfforts = new Set(["low", "medium", "high", "xhigh", "max"]);
const thinkingDisplays = new Set(["summarized", "omitted"]);
const executables = new Set(["bun", "deno", "node"]);
const sessionStoreFlushValues = new Set(["batched", "eager"]);
const settingSourceValues = new Set(["user", "project", "local"]);

export function sanitizeUserSdkOptions(input: unknown): UserSdkOptions {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const options: UserSdkOptions = {};

  if (typeof source.permissionMode === "string" && permissionModes.has(source.permissionMode)) {
    options.permissionMode = source.permissionMode as PermissionMode;
  }
  if (Number.isInteger(source.maxTurns) && (source.maxTurns as number) > 0) {
    options.maxTurns = source.maxTurns as number;
  }
  if (typeof source.max_budget_usd === "number" && source.max_budget_usd > 0) options.max_budget_usd = source.max_budget_usd;
  if (typeof source.enableFileCheckpointing === "boolean") options.enableFileCheckpointing = source.enableFileCheckpointing;
  if (typeof source.fallback_model === "string" && source.fallback_model.length > 0) options.fallback_model = source.fallback_model;
  if (Array.isArray(source.additionalDirectories) && source.additionalDirectories.every((v) => typeof v === "string")) {
    options.additionalDirectories = source.additionalDirectories as string[];
  }
  if (Array.isArray(source.allowedTools) && source.allowedTools.every((v) => typeof v === "string")) {
    options.allowedTools = source.allowedTools as string[];
  }
  if (Array.isArray(source.disallowedTools) && source.disallowedTools.every((v) => typeof v === "string")) {
    options.disallowedTools = source.disallowedTools as string[];
  }
  if (source.agents && typeof source.agents === "object" && !Array.isArray(source.agents)) options.agents = source.agents as Record<string, unknown>;
  if (source.skills && (Array.isArray(source.skills) || typeof source.skills === "object")) options.skills = source.skills as UserSdkOptions["skills"];
  if (source.hooks && typeof source.hooks === "object" && !Array.isArray(source.hooks)) options.hooks = source.hooks as Record<string, unknown>;
  if (Array.isArray(source.tools)) options.tools = source.tools;
  if (source.mcpServers && typeof source.mcpServers === "object" && !Array.isArray(source.mcpServers)) options.mcpServers = source.mcpServers as Record<string, unknown>;
  if (typeof source.systemPrompt === "string") options.systemPrompt = source.systemPrompt;
  if (source.thinking && typeof source.thinking === "object") {
    const thinking = source.thinking as Record<string, unknown>;
    options.thinking = {
      ...(typeof thinking.effort === "string" && thinkingEfforts.has(thinking.effort) ? { effort: thinking.effort as ThinkingEffort } : {}),
      ...(typeof thinking.display === "string" && thinkingDisplays.has(thinking.display) ? { display: thinking.display as ThinkingDisplay } : {}),
    };
  }
  if (source.toolChoice !== undefined) options.toolChoice = source.toolChoice;
  if (source.outputConfig !== undefined) options.outputConfig = source.outputConfig;
  if (source.contextEditing !== undefined) options.contextEditing = source.contextEditing;
  if (source.compaction !== undefined) options.compaction = source.compaction;
  if (typeof source.promptCaching === "boolean") options.promptCaching = source.promptCaching;
  // ===== A 组：白名单 Set 校验 =====
  if (typeof source.effort === "string" && thinkingEfforts.has(source.effort)) {
    options.effort = source.effort as ThinkingEffort;
  }
  if (typeof source.executable === "string" && executables.has(source.executable)) {
    options.executable = source.executable as Executable;
  }
  if (typeof source.sessionStoreFlush === "string" && sessionStoreFlushValues.has(source.sessionStoreFlush)) {
    options.sessionStoreFlush = source.sessionStoreFlush as SessionStoreFlushValue;
  }
  if (Array.isArray(source.betas) && source.betas.every((v) => typeof v === "string")) {
    options.betas = source.betas as string[];
  }
  if (Array.isArray(source.settingSources) && source.settingSources.every((v) => typeof v === "string" && settingSourceValues.has(v))) {
    options.settingSources = source.settingSources as SettingSourceValue[];
  }
  // ===== B 组：类型守卫 =====
  if (typeof source.title === "string") options.title = source.title;
  if (typeof source.debug === "boolean") options.debug = source.debug;
  if (typeof source.debugFile === "string") options.debugFile = source.debugFile;
  if (typeof source.strictMcpConfig === "boolean") options.strictMcpConfig = source.strictMcpConfig;
  if (typeof source.persistSession === "boolean") options.persistSession = source.persistSession;
  if (typeof source.includeHookEvents === "boolean") options.includeHookEvents = source.includeHookEvents;
  if (typeof source.forwardSubagentText === "boolean") options.forwardSubagentText = source.forwardSubagentText;
  if (typeof source.promptSuggestions === "boolean") options.promptSuggestions = source.promptSuggestions;
  if (typeof source.agentProgressSummaries === "boolean") options.agentProgressSummaries = source.agentProgressSummaries;
  if (typeof source.allowDangerouslySkipPermissions === "boolean") options.allowDangerouslySkipPermissions = source.allowDangerouslySkipPermissions;
  if (typeof source.planModeInstructions === "string") options.planModeInstructions = source.planModeInstructions;
  if (typeof source.permissionPromptToolName === "string") options.permissionPromptToolName = source.permissionPromptToolName;
  // ===== C 组：结构校验 =====
  if (source.toolConfig && typeof source.toolConfig === "object" && !Array.isArray(source.toolConfig)) {
    options.toolConfig = source.toolConfig as UserSdkOptions["toolConfig"];
  }
  if (source.sandbox && typeof source.sandbox === "object" && !Array.isArray(source.sandbox)) {
    options.sandbox = source.sandbox as UserSdkOptions["sandbox"];
  }
  if (Array.isArray(source.plugins)) {
    options.plugins = source.plugins.filter(
      (p: unknown) => p && typeof p === "object" && (p as Record<string, unknown>).type === "local" && typeof (p as Record<string, unknown>).path === "string"
    );
  }
  if (source.managedSettings && typeof source.managedSettings === "object" && !Array.isArray(source.managedSettings)) {
    options.managedSettings = source.managedSettings as Record<string, unknown>;
  }
  if (typeof source.settings === "string" || (source.settings && typeof source.settings === "object" && !Array.isArray(source.settings))) {
    options.settings = source.settings as string | Record<string, unknown>;
  }
  if (source.toolAliases && typeof source.toolAliases === "object" && !Array.isArray(source.toolAliases)) {
    const aliases: Record<string, string> = {};
    for (const [k, v] of Object.entries(source.toolAliases as Record<string, unknown>)) {
      if (typeof v === "string") aliases[k] = v;
    }
    if (Object.keys(aliases).length > 0) options.toolAliases = aliases;
  }
  if (typeof source.agent === "string") options.agent = source.agent;
  if (source.extraArgs && typeof source.extraArgs === "object" && !Array.isArray(source.extraArgs)) {
    const args: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(source.extraArgs as Record<string, unknown>)) {
      if (typeof v === "string" || v === null) args[k] = v;
    }
    if (Object.keys(args).length > 0) options.extraArgs = args;
  }
  if (Array.isArray(source.executableArgs) && source.executableArgs.every((v: unknown) => typeof v === "string")) {
    options.executableArgs = source.executableArgs as string[];
  }
  if (typeof source.resumeSessionAt === "string") options.resumeSessionAt = source.resumeSessionAt;
  if (source.outputFormat && typeof source.outputFormat === "object" && !Array.isArray(source.outputFormat)) {
    const fmt = source.outputFormat as Record<string, unknown>;
    if (fmt.type === "json_schema" && fmt.json_schema && typeof fmt.json_schema === "object") {
      const js = fmt.json_schema as Record<string, unknown>;
      if (typeof js.name === "string" && js.name.length > 0 && js.schema && typeof js.schema === "object") {
        options.outputFormat = fmt as UserSdkOptions["outputFormat"];
      }
    }
  }

  return options;
}

const forbiddenAnthropicEnv = new Set([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_CUSTOM_HEADERS",
  "ANTHROPIC_MODEL",
]);

function claudeNativePackageName(platform = process.platform, arch = process.arch) {
  return `claude-agent-sdk-${platform}-${arch}`;
}

function claudeNativeBinaryName(platform = process.platform) {
  return platform === "win32" ? "claude.exe" : "claude";
}

export function pathToClaudeCodeExecutableForCwd(cwd: string) {
  const packageName = claudeNativePackageName();
  const binaryName = claudeNativeBinaryName();
  const candidates = [
    path.join(cwd, "resources", "app.asar.unpacked", "node_modules", "@anthropic-ai", packageName, binaryName),
    path.join(cwd, "node_modules", "@anthropic-ai", packageName, binaryName),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

export function sanitizeProcessEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || forbiddenAnthropicEnv.has(key)) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function assertThirdPartyBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  const host = url.hostname.toLowerCase();
  if (host === "api.anthropic.com" || host.endsWith(".anthropic.com")) {
    throw new Error("请使用第三方 API 网关地址，不支持 Anthropic 官方端点");
  }
}

function degradeOutputFormatToPrompt(of: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } }): string {
  const schema = of.json_schema.schema;
  const fields = extractFieldNames(schema);
  const lines = ["请以 JSON 格式输出，必须包含以下字段："];
  for (const f of fields) lines.push(`- ${f}`);
  lines.push("", "以 ```json ... ``` 代码块包裹 JSON 输出。");
  return lines.join("\n");
}

function extractFieldNames(schema: Record<string, unknown>, prefix = ""): string[] {
  const result: string[] = [];
  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    for (const [key, prop] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const desc = prop.description ? ` (${prop.description})` : "";
      result.push(`${fullPath}: ${prop.type ?? "string"}${desc}`);
    }
  }
  return result;
}

export async function loadAgentRuntimeConfig(input: {
  cwd: string;
  claudeConfigDir?: string | null;
  userSdkOptions?: unknown;
  codeOptions?: {
    onElicitation?: OnElicitation;
    spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
    stderr?: (data: string) => void;
    abortController?: AbortController;
  };
}): Promise<AgentRuntimeConfig & { model: string; degradations: Array<{ feature: string; reason: string }> }> {
  const settings = loadClaudeCodeSettings({ cwd: input.cwd });
  const baseUrl = settings.baseUrl.trim();
  const authToken = settings.apiKey.trim();
  const model = settings.model.trim();

  if (!baseUrl) {
    throw new Error(
      ".claude/settings.json or .claude/settings.local.json is required: env.ANTHROPIC_BASE_URL is missing",
    );
  }
  if (!authToken) {
    throw new Error(
      ".claude/settings.json or .claude/settings.local.json is required: env.ANTHROPIC_AUTH_TOKEN is missing",
    );
  }
  if (!model) {
    throw new Error(
      ".claude/settings.json or .claude/settings.local.json is required: env.ANTHROPIC_MODEL is missing",
    );
  }
  assertThirdPartyBaseUrl(baseUrl);

  const pathToClaudeCodeExecutable = pathToClaudeCodeExecutableForCwd(input.cwd);
  const userSdkOptions = sanitizeUserSdkOptions(input.userSdkOptions);

  // Load SDK-resolved settings for proper multi-tier merge
  let resolvedEffort: string | undefined;
  let resolvedSandboxEnabled: boolean | undefined;
  try {
    const resolved = await loadResolvedSettings(input.cwd);
    const env = (resolved.effective as Record<string, unknown>).env as Record<string, string> | undefined;
    if (!userSdkOptions.effort && env?.CLAUDE_CODE_EFFORT) {
      resolvedEffort = env.CLAUDE_CODE_EFFORT;
    }
    if (userSdkOptions.sandbox?.enabled === undefined && env?.CLAUDE_CODE_SANDBOX_ENABLED) {
      resolvedSandboxEnabled = env.CLAUDE_CODE_SANDBOX_ENABLED === "true";
    }
  } catch {
    // Fallback to manual settings only (already loaded)
  }

  // Thinking 配置：userSdkOptions 优先，兜底 display 为 summarized
  const thinking = {
    display: "summarized" as ThinkingDisplay,
    ...(userSdkOptions.thinking ?? {}),
  };

  // === 合并 settings 中的新字段：userSdkOptions 优先，settings 作为默认值 ===
  const effort = userSdkOptions.effort ?? resolvedEffort ?? settings.effort;
  const sandboxEnabled = userSdkOptions.sandbox?.enabled !== undefined
    ? userSdkOptions.sandbox.enabled
    : resolvedSandboxEnabled !== undefined
    ? resolvedSandboxEnabled
    : settings.sandboxEnabled;

  // === 构建合并后的 sdkOptions ===
  const mergedOptions: Record<string, unknown> = {
    ...userSdkOptions,
    cwd: input.cwd,
    tools: [...(userSdkOptions.tools ?? []), ...customTools],
    ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
    includePartialMessages: true,
    permissionMode: userSdkOptions.permissionMode ?? "default",
    thinking,
    // 新字段合并（userSdkOptions 已经包含了这些字段，此处用合并后的值覆盖）
    ...(effort ? { effort } : {}),
    ...(sandboxEnabled !== undefined
      ? { sandbox: { ...(userSdkOptions.sandbox ?? {}), enabled: sandboxEnabled } }
      : userSdkOptions.sandbox
        ? { sandbox: userSdkOptions.sandbox }
        : {}),
    ...(userSdkOptions.max_budget_usd !== undefined ? { max_budget_usd: userSdkOptions.max_budget_usd } : {}),
    ...(userSdkOptions.enableFileCheckpointing !== undefined ? { enableFileCheckpointing: userSdkOptions.enableFileCheckpointing } : {}),
    ...(userSdkOptions.fallback_model ? { fallback_model: userSdkOptions.fallback_model } : {}),
    ...(input.claudeConfigDir ? { env: { CLAUDE_CONFIG_DIR: input.claudeConfigDir } } : {}),
    // 注入 codeOptions：将回调/实例类型的运行时选项传递到 SDK options
    ...(input.codeOptions?.onElicitation ? { onElicitation: input.codeOptions.onElicitation } : {}),
    ...(input.codeOptions?.spawnClaudeCodeProcess ? { spawnClaudeCodeProcess: input.codeOptions.spawnClaudeCodeProcess } : {}),
    ...(input.codeOptions?.stderr ? { stderr: input.codeOptions.stderr } : {}),
    ...(input.codeOptions?.abortController ? { abortController: input.codeOptions.abortController } : {}),
  };

  // === 注册应用级 MCP Server ===
  if (appMcpServer) {
    mergedOptions.mcpServers = {
      ...(mergedOptions.mcpServers ?? {}),
      "ai-test-assistant": appMcpServer,
    };
  }

  // === 模型能力检测 + 自动降级 ===
  const degradations: Array<{ feature: string; reason: string }> = [];
  if (model) {
    let caps: ModelCapabilities | undefined;
    try {
      caps = await detectModelCapabilities(
        { query: /* NOTE: SDK query not available here; use heuristic */ undefined as any },
        model,
      );
    } catch {
      // caps 保持 undefined，由下方统一回退
    }

    // 非 probe 结果（含探测失败和 heuristic）统一回退到乐观默认值
    if (!caps || caps.detectionMethod !== "probe") {
      caps = { model, supportsThinking: true, supportsJsonSchema: true, supportsPromptCaching: true, maxContextWindow: 200000, supportsToolUse: true, detectedAt: Date.now(), detectionMethod: "heuristic" };
    }

    if (!caps.supportsThinking) {
      delete mergedOptions.thinking;
      delete mergedOptions.effort;
      degradations.push({ feature: "thinking", reason: "模型不支持" });
    }
    if (!caps.supportsJsonSchema && mergedOptions.outputConfig) {
      const outputConfig = mergedOptions.outputConfig as Record<string, unknown>;
      const formatObj = outputConfig.format ?? outputConfig;
      try {
        const promptInjection = degradeOutputFormatToPrompt(formatObj as any);
        mergedOptions.systemPrompt = ((mergedOptions.systemPrompt as string) ?? "") + "\n\n" + promptInjection;
      } catch { /* schema structure unexpected, skip degradation */ }
      delete mergedOptions.outputConfig;
      degradations.push({ feature: "jsonSchema", reason: "模型不支持，已降级为自然语言格式要求" });
    }
    if (!caps.supportsPromptCaching) {
      delete mergedOptions.promptCaching;
      degradations.push({ feature: "promptCaching", reason: "模型不支持" });
    }
  }

  return {
    cwd: input.cwd,
    sdkOptions: mergedOptions,
    model,
    degradations,
  };
}
