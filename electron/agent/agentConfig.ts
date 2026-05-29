import fs from "node:fs";
import path from "node:path";
import { loadClaudeCodeSettings } from "./sdkSettings.js";

export type AgentRuntimeConfig = {
  cwd: string;
  sdkOptions: Record<string, unknown>;
};

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

  return {
    cwd: input.cwd,
    sdkOptions: {
      cwd: input.cwd,
      ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
      includePartialMessages: true,
      permissionMode: "default",
      ...(input.claudeConfigDir ? { env: { CLAUDE_CONFIG_DIR: input.claudeConfigDir } } : {}),
    },
  };
}
