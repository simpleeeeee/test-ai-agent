import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureClaudeCodeSettings, loadClaudeCodeSettings, saveClaudeCodeSettings, settingsLocalPathForCwd, settingsPathForCwd } from "./sdkSettings.js";

describe("sdkSettings", () => {
  it("writes the native Claude Code project settings shape", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));

    const saved = saveClaudeCodeSettings({
      cwd,
      baseUrl: "https://gateway.example.com/anthropic",
      apiKey: "plain-text-key",
      model: "claude-compatible-model",
    });

    expect(saved).toEqual({
      $schema: "https://json.schemastore.org/claude-code-settings.json",
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "plain-text-key",
        ANTHROPIC_MODEL: "claude-compatible-model",
      },
    });
    expect(JSON.parse(fs.readFileSync(settingsPathForCwd(cwd), "utf8"))).toEqual(saved);
  });

  it("loads only the SDK-native settings fields needed by the UI", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      $schema: "https://json.schemastore.org/claude-code-settings.json",
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "plain-text-key",
        ANTHROPIC_MODEL: "claude-compatible-model",
        OTHER_ENV: "kept-by-sdk",
      },
      permissions: { allow: ["Bash(npm test *)"] },
    }, null, 2));

    expect(loadClaudeCodeSettings({ cwd })).toEqual({
      baseUrl: "https://gateway.example.com/anthropic",
      apiKey: "plain-text-key",
      model: "claude-compatible-model",
    });
  });

  it("returns empty UI values when neither settings file exists (no .claude directory)", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));

    expect(loadClaudeCodeSettings({ cwd })).toEqual({
      baseUrl: "",
      apiKey: "",
      model: "",
    });
  });

  it("reads from settings.local.json when settings.json does not exist", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsLocalPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://local-only.example.com",
        ANTHROPIC_AUTH_TOKEN: "local-only-token",
        ANTHROPIC_MODEL: "local-only-model",
      },
    }, null, 2));

    expect(loadClaudeCodeSettings({ cwd })).toEqual({
      baseUrl: "https://local-only.example.com",
      apiKey: "local-only-token",
      model: "local-only-model",
    });
  });

  it("creates a minimal native settings file without $schema when packaging needs a visible file", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));

    const settingsPath = ensureClaudeCodeSettings({ cwd });

    expect(settingsPath).toBe(settingsPathForCwd(cwd));
    const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(parsed).toEqual({
      env: {
        ANTHROPIC_BASE_URL: "",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "",
      },
    });
    expect(parsed).not.toHaveProperty("$schema");
  });

  it("does not create settings.json when settings.local.json already exists", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsLocalPathForCwd(cwd), JSON.stringify({
      env: { ANTHROPIC_MODEL: "local-model" },
    }, null, 2));

    ensureClaudeCodeSettings({ cwd });

    expect(fs.existsSync(settingsPathForCwd(cwd))).toBe(false);
  });

  it("merges settings.local.json over settings.json for UI fields", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://shared.example.com",
        ANTHROPIC_AUTH_TOKEN: "shared-token",
        ANTHROPIC_MODEL: "shared-model",
      },
    }, null, 2));
    fs.writeFileSync(settingsLocalPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_MODEL: "local-model",
      },
    }, null, 2));

    expect(loadClaudeCodeSettings({ cwd })).toEqual({
      baseUrl: "https://shared.example.com",
      apiKey: "shared-token",
      model: "local-model",
    });
  });

  it("returns empty UI values when neither settings file exists", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));

    expect(loadClaudeCodeSettings({ cwd })).toEqual({
      baseUrl: "",
      apiKey: "",
      model: "",
    });
  });

  it("does not overwrite an existing native settings file on startup", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    const existing = {
      $schema: "https://json.schemastore.org/claude-code-settings.json",
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "plain-text-key",
        ANTHROPIC_MODEL: "claude-compatible-model",
      },
    };
    fs.writeFileSync(settingsPathForCwd(cwd), `${JSON.stringify(existing, null, 2)}\n`, "utf8");

    ensureClaudeCodeSettings({ cwd });

    expect(JSON.parse(fs.readFileSync(settingsPathForCwd(cwd), "utf8"))).toEqual(existing);
  });
});
