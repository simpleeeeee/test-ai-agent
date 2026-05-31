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
  effort?: string;          // 推理努力程度: low | medium | high | xhigh | max
  sandboxEnabled?: boolean; // 沙箱是否启用
};

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
  return {
    baseUrl: stringValue(local.env?.ANTHROPIC_BASE_URL ?? shared.env?.ANTHROPIC_BASE_URL),
    apiKey: stringValue(local.env?.ANTHROPIC_AUTH_TOKEN ?? shared.env?.ANTHROPIC_AUTH_TOKEN),
    model: stringValue(local.env?.ANTHROPIC_MODEL ?? shared.env?.ANTHROPIC_MODEL),
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
    },
  };

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}
