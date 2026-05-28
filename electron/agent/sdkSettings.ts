import fs from "node:fs";
import path from "node:path";

type NativeClaudeCodeSettings = {
  $schema?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
};

export type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export const CLAUDE_SETTINGS_SCHEMA = "https://json.schemastore.org/claude-code-settings.json";

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
  const settings = readNativeSettings(settingsPathForCwd(cwd));
  return {
    baseUrl: stringValue(settings.env?.ANTHROPIC_BASE_URL),
    apiKey: stringValue(settings.env?.ANTHROPIC_AUTH_TOKEN),
    model: stringValue(settings.env?.ANTHROPIC_MODEL),
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
  const settingsPath = settingsPathForCwd(input.cwd);
  const existing = readNativeSettings(settingsPath);
  const { model: _legacyModel, ...existingWithoutLegacyModel } = existing;
  const settings: NativeClaudeCodeSettings = {
    ...existingWithoutLegacyModel,
    $schema: CLAUDE_SETTINGS_SCHEMA,
    env: {
      ...(existing.env ?? {}),
      ANTHROPIC_BASE_URL: input.baseUrl.trim(),
      ANTHROPIC_AUTH_TOKEN: input.apiKey.trim(),
      ANTHROPIC_MODEL: input.model.trim(),
    },
  };

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}
