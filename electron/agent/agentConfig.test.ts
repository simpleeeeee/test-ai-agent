import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAgentRuntimeConfig, sanitizeProcessEnv } from "./agentConfig.js";
import { settingsPathForCwd } from "./sdkSettings.js";

describe("sanitizeProcessEnv", () => {
  it("removes official Anthropic environment variables before SDK launch", () => {
    const env = sanitizeProcessEnv({
      PATH: "C:/bin",
      SystemRoot: "C:/Windows",
      ANTHROPIC_API_KEY: "official-key",
      ANTHROPIC_AUTH_TOKEN: "old-token",
      ANTHROPIC_BASE_URL: "https://api.anthropic.com",
      ANTHROPIC_CUSTOM_HEADERS: "x-secret=1",
      ANTHROPIC_MODEL: "external-model",
    });

    expect(env).toEqual({
      PATH: "C:/bin",
      SystemRoot: "C:/Windows",
    });
  });
});

describe("loadAgentRuntimeConfig", () => {
  it("uses app base directory as cwd and does not force settings path", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    const unpackedClaudeExe = path.join(
      cwd,
      "resources",
      "app.asar.unpacked",
      "node_modules",
      "@anthropic-ai",
      "claude-agent-sdk-win32-x64",
      "claude.exe",
    );
    fs.mkdirSync(path.dirname(unpackedClaudeExe), { recursive: true });
    fs.writeFileSync(unpackedClaudeExe, "");
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "third-party-token",
        ANTHROPIC_MODEL: "claude-compatible-test-model",
      },
    }, null, 2));

    const config = loadAgentRuntimeConfig({ cwd });

    expect(config.sdkOptions).toEqual(expect.objectContaining({
      cwd,
      includePartialMessages: true,
      permissionMode: "default",
    }));
    expect(config.sdkOptions).not.toHaveProperty("settings");
    expect(config.sdkOptions).not.toHaveProperty("model");
  });

  it("fails fast when required env fields are missing from both settings files", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));

    expect(() => loadAgentRuntimeConfig({ cwd }))
      .toThrow(/\.claude\/settings\.json.*\.claude\/settings\.local\.json/);
  });

  it("rejects official Anthropic endpoints", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://api.anthropic.com",
        ANTHROPIC_AUTH_TOKEN: "token",
        ANTHROPIC_MODEL: "claude-compatible-test-model",
      },
    }, null, 2));

    expect(() => loadAgentRuntimeConfig({
      cwd,
    })).toThrow("Official Anthropic endpoints are not allowed");
  });
});
