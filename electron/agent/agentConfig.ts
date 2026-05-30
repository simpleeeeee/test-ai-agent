import fs from "node:fs";
import path from "node:path";
import { loadClaudeCodeSettings } from "./sdkSettings.js";

export type AgentRuntimeConfig = {
  cwd: string;
  sdkOptions: Record<string, unknown>;
};

type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";
type ThinkingEffort = "low" | "medium" | "high" | "xhigh" | "max";
type ThinkingDisplay = "summarized" | "omitted";

export type UserSdkOptions = {
  permissionMode?: PermissionMode;
  maxTurns?: number;
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
};

const permissionModes = new Set(["default", "acceptEdits", "bypassPermissions", "plan"]);
const thinkingEfforts = new Set(["low", "medium", "high", "xhigh", "max"]);
const thinkingDisplays = new Set(["summarized", "omitted"]);

function sanitizeUserSdkOptions(input: unknown): UserSdkOptions {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const options: UserSdkOptions = {};

  if (typeof source.permissionMode === "string" && permissionModes.has(source.permissionMode)) {
    options.permissionMode = source.permissionMode as PermissionMode;
  }
  if (Number.isInteger(source.maxTurns) && (source.maxTurns as number) > 0) {
    options.maxTurns = source.maxTurns as number;
  }
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
  if (source.promptCaching !== undefined) options.promptCaching = source.promptCaching;

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
    throw new Error("Official Anthropic endpoints are not allowed");
  }
}

export function loadAgentRuntimeConfig(input: {
  cwd: string;
  claudeConfigDir?: string | null;
  userSdkOptions?: unknown;
}): AgentRuntimeConfig {
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
  const thinking = {
    display: "summarized" as ThinkingDisplay,
    ...(userSdkOptions.thinking ?? {}),
  };

  return {
    cwd: input.cwd,
    sdkOptions: {
      ...userSdkOptions,
      cwd: input.cwd,
      ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
      includePartialMessages: true,
      permissionMode: userSdkOptions.permissionMode ?? "default",
      thinking,
      ...(input.claudeConfigDir ? { env: { CLAUDE_CONFIG_DIR: input.claudeConfigDir } } : {}),
    },
  };
}
