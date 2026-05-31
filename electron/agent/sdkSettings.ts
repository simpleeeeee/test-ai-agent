import fs from "node:fs";
import path from "node:path";
import { resolveSettings, filterEscalatingDefaultMode } from "./claudeAgentSdkFacade.js";
import type { ResolvedSettings, Settings } from "./claudeAgentSdkFacade.js";

type NativeClaudeCodeSettings = {
  $schema?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
};

export type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
  effort?: string;          // 推理努力程度: low | medium | high | xhigh | max
  sandboxEnabled?: boolean; // 沙箱是否启用
  promptCaching?: boolean;  // Prompt 缓存开关
  debug?: boolean;          // 调试模式：记录 SDK 原始消息
  debugFile?: string;       // 调试日志文件路径
  maxBudgetUsd?: number;    // 成本上限 (USD)
  maxTurns?: number;        // 最大对话轮数
  outputFormat?: { template?: string; customSchema?: string | null }; // 结构化输出配置
  permissionMode?: string;  // SDK 权限模式
  thinkingEffort?: string;  // 思考强度
  thinkingDisplay?: string; // Thinking 展示方式
  theme?: "light" | "dark"; // UI 主题
};

function appSettingsPath(cwd: string) {
  return path.join(cwd, ".claude", "app-settings.json");
}

export type AppSettings = {
  version: number;
  outputFormat?: { template?: string; customSchema?: string | null };
  permissionMode?: string;
  thinkingEffort?: string;
  thinkingDisplay?: string;
  theme?: "light" | "dark";
  lastConnectionCheck?: number;
};

export function loadAppSettings(cwd: string): AppSettings {
  try {
    const p = appSettingsPath(cwd);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8")) as AppSettings;
  } catch { /* ignore */ }
  return { version: 1 };
}

export function saveAppSettings(cwd: string, settings: AppSettings): void {
  const p = appSettingsPath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ ...settings, version: 1 }, null, 2), "utf8");
}

export function settingsPathForCwd(cwd: string) {
  return path.join(cwd, ".claude", "settings.json");
}

export function settingsLocalPathForCwd(cwd: string) {
  return path.join(cwd, ".claude", "settings.local.json");
}

function emptyNativeSettings(): NativeClaudeCodeSettings {
  return {
    env: {
      ANTHROPIC_BASE_URL: "",
      ANTHROPIC_AUTH_TOKEN: "",
      ANTHROPIC_MODEL: "",
    },
  };
}

function readNativeSettings(settingsPath: string): NativeClaudeCodeSettings {
  if (!fs.existsSync(settingsPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(settingsPath, "utf8")) as NativeClaudeCodeSettings;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function loadClaudeCodeSettings({ cwd }: { cwd: string }): SettingsFormValues {
  const shared = readNativeSettings(settingsPathForCwd(cwd));
  const local = readNativeSettings(settingsLocalPathForCwd(cwd));
  const appSettings = loadAppSettings(cwd);
  return {
    baseUrl: stringValue(local.env?.ANTHROPIC_BASE_URL ?? shared.env?.ANTHROPIC_BASE_URL),
    apiKey: stringValue(local.env?.ANTHROPIC_AUTH_TOKEN ?? shared.env?.ANTHROPIC_AUTH_TOKEN),
    model: stringValue(local.env?.ANTHROPIC_MODEL ?? shared.env?.ANTHROPIC_MODEL),
    effort: stringValue(local.env?.CLAUDE_CODE_EFFORT ?? shared.env?.CLAUDE_CODE_EFFORT) || undefined,
    sandboxEnabled: (local.env?.CLAUDE_CODE_SANDBOX_ENABLED ?? shared.env?.CLAUDE_CODE_SANDBOX_ENABLED) === "true" ? true
      : (local.env?.CLAUDE_CODE_SANDBOX_ENABLED ?? shared.env?.CLAUDE_CODE_SANDBOX_ENABLED) === "false" ? false
      : undefined,
    promptCaching: (local.env?.CLAUDE_CODE_PROMPT_CACHING ?? shared.env?.CLAUDE_CODE_PROMPT_CACHING) === "true" ? true
      : (local.env?.CLAUDE_CODE_PROMPT_CACHING ?? shared.env?.CLAUDE_CODE_PROMPT_CACHING) === "false" ? false
      : undefined,
    debug: (local.env?.CLAUDE_CODE_DEBUG ?? shared.env?.CLAUDE_CODE_DEBUG) === "true" ? true
      : (local.env?.CLAUDE_CODE_DEBUG ?? shared.env?.CLAUDE_CODE_DEBUG) === "false" ? false
      : undefined,
    debugFile: stringValue(local.env?.CLAUDE_CODE_DEBUG_FILE ?? shared.env?.CLAUDE_CODE_DEBUG_FILE) || undefined,
    maxBudgetUsd: parseFloat(local.env?.CLAUDE_CODE_MAX_BUDGET_USD ?? shared.env?.CLAUDE_CODE_MAX_BUDGET_USD ?? "") || undefined,
    maxTurns: parseInt(local.env?.CLAUDE_CODE_MAX_TURNS ?? shared.env?.CLAUDE_CODE_MAX_TURNS ?? "", 10) || undefined,
    outputFormat: appSettings.outputFormat,
    permissionMode: appSettings.permissionMode,
    thinkingEffort: appSettings.thinkingEffort,
    thinkingDisplay: appSettings.thinkingDisplay,
    theme: appSettings.theme,
  };
}

export function ensureClaudeCodeSettings({ cwd }: { cwd: string }) {
  const settingsPath = settingsPathForCwd(cwd);
  const localPath = settingsLocalPathForCwd(cwd);
  if (!fs.existsSync(settingsPath) && !fs.existsSync(localPath)) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, `${JSON.stringify(emptyNativeSettings(), null, 2)}\n`, "utf8");
  }
  return settingsPath;
}

export function saveClaudeCodeSettings(input: SettingsFormValues & { cwd: string }): NativeClaudeCodeSettings {
  const localPath = settingsLocalPathForCwd(input.cwd);
  const sharedPath = settingsPathForCwd(input.cwd);

  let targetPath: string;
  if (fs.existsSync(localPath)) {
    targetPath = localPath;
  } else {
    targetPath = sharedPath;
  }

  const existing = readNativeSettings(targetPath);
  const settings: NativeClaudeCodeSettings = {
    ...existing,
    env: {
      ...(existing.env ?? {}),
      ANTHROPIC_BASE_URL: input.baseUrl.trim(),
      ANTHROPIC_AUTH_TOKEN: input.apiKey.trim(),
      ANTHROPIC_MODEL: input.model.trim(),
      ...(input.effort ? { CLAUDE_CODE_EFFORT: input.effort } : {}),
      ...(input.sandboxEnabled !== undefined ? { CLAUDE_CODE_SANDBOX_ENABLED: String(input.sandboxEnabled) } : {}),
      ...(input.promptCaching !== undefined ? { CLAUDE_CODE_PROMPT_CACHING: String(input.promptCaching) } : {}),
      ...(input.debug !== undefined ? { CLAUDE_CODE_DEBUG: String(input.debug) } : {}),
      ...(input.debugFile ? { CLAUDE_CODE_DEBUG_FILE: input.debugFile } : {}),
      ...(input.maxBudgetUsd !== undefined ? { CLAUDE_CODE_MAX_BUDGET_USD: String(input.maxBudgetUsd) } : {}),
      ...(input.maxTurns !== undefined ? { CLAUDE_CODE_MAX_TURNS: String(input.maxTurns) } : {}),
    },
  };

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

export async function loadResolvedSettings(cwd: string): Promise<{
  effective: Settings;
  provenance: Record<string, { source: string; path?: string }>;
}> {
  try {
    const resolved: ResolvedSettings = await resolveSettings({ cwd });
    const safe: Settings = filterEscalatingDefaultMode(resolved);
    return {
      effective: safe,
      provenance: (resolved.provenance ?? {}) as Record<string, { source: string; path?: string }>,
    };
  } catch (error) {
    console.warn("resolveSettings failed, falling back to manual merge:", error);
    const manual = loadClaudeCodeSettings({ cwd });
    return {
      effective: {
        env: {
          ANTHROPIC_BASE_URL: manual.baseUrl,
          ANTHROPIC_AUTH_TOKEN: manual.apiKey,
          ANTHROPIC_MODEL: manual.model,
          ...(manual.effort ? { CLAUDE_CODE_EFFORT: manual.effort } : {}),
          ...(manual.sandboxEnabled !== undefined ? { CLAUDE_CODE_SANDBOX_ENABLED: String(manual.sandboxEnabled) } : {}),
          ...(manual.promptCaching !== undefined ? { CLAUDE_CODE_PROMPT_CACHING: String(manual.promptCaching) } : {}),
          ...(manual.debug !== undefined ? { CLAUDE_CODE_DEBUG: String(manual.debug) } : {}),
          ...(manual.debugFile ? { CLAUDE_CODE_DEBUG_FILE: manual.debugFile } : {}),
          ...(manual.maxBudgetUsd !== undefined ? { CLAUDE_CODE_MAX_BUDGET_USD: String(manual.maxBudgetUsd) } : {}),
          ...(manual.maxTurns !== undefined ? { CLAUDE_CODE_MAX_TURNS: String(manual.maxTurns) } : {}),
        },
      } as Settings,
      provenance: {},
    };
  }
}

export function filterEscalatingMode(resolved: ResolvedSettings): Settings {
  return filterEscalatingDefaultMode(resolved);
}
