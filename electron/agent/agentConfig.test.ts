import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAgentRuntimeConfig, sanitizeProcessEnv, sanitizeUserSdkOptions } from "./agentConfig.js";
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

  it("passes CLAUDE_CONFIG_DIR in sdkOptions.env when claudeConfigDir is provided", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "third-party-token",
        ANTHROPIC_MODEL: "claude-compatible-test-model",
      },
    }, null, 2));

    const config = loadAgentRuntimeConfig({ cwd, claudeConfigDir: "D:/app/.claude" });

    expect(config.sdkOptions).toEqual(expect.objectContaining({
      cwd,
      env: { CLAUDE_CONFIG_DIR: "D:/app/.claude" },
      includePartialMessages: true,
      permissionMode: "default",
    }));
    expect(config.sdkOptions).not.toHaveProperty("settings");
  });

  it("does not set CLAUDE_CONFIG_DIR when claudeConfigDir is null", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "third-party-token",
        ANTHROPIC_MODEL: "claude-compatible-test-model",
      },
    }, null, 2));

    const config = loadAgentRuntimeConfig({ cwd, claudeConfigDir: null });

    expect(config.sdkOptions.env).toBeUndefined();
  });

  it("does not set CLAUDE_CONFIG_DIR when claudeConfigDir is undefined (backward compat)", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "third-party-token",
        ANTHROPIC_MODEL: "claude-compatible-test-model",
      },
    }, null, 2));

    const config = loadAgentRuntimeConfig({ cwd });

    expect(config.sdkOptions.env).toBeUndefined();
  });

  it("merges supported SDK options while preserving required safety options", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "third-party-token",
        ANTHROPIC_MODEL: "claude-compatible-test-model",
      },
    }, null, 2));

    const config = loadAgentRuntimeConfig({
      cwd,
      userSdkOptions: {
        permissionMode: "plan",
        maxTurns: 5,
        additionalDirectories: ["D:/workspace/shared"],
        allowedTools: ["Read", "Grep"],
        disallowedTools: ["Bash"],
        systemPrompt: "你是测试助手",
        thinking: { effort: "high", display: "summarized" },
        toolChoice: { type: "auto" },
        outputConfig: { format: { type: "json_schema", schema: { type: "object" } } },
        cwd: "D:/malicious",
        includePartialMessages: false,
      },
    } as any);

    expect(config.sdkOptions).toEqual(expect.objectContaining({
      cwd,
      includePartialMessages: true,
      permissionMode: "plan",
      maxTurns: 5,
      additionalDirectories: ["D:/workspace/shared"],
      allowedTools: ["Read", "Grep"],
      disallowedTools: ["Bash"],
      systemPrompt: "你是测试助手",
      thinking: { effort: "high", display: "summarized" },
      toolChoice: { type: "auto" },
      outputConfig: { format: { type: "json_schema", schema: { type: "object" } } },
    }));

    expect(config.sdkOptions).not.toHaveProperty("cwd", "D:/malicious");
  });

  it("defaults thinking display to summarized", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));
    fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "third-party-token",
        ANTHROPIC_MODEL: "claude-compatible-test-model",
      },
    }, null, 2));

    const config = loadAgentRuntimeConfig({ cwd });

    expect(config.sdkOptions).toEqual(expect.objectContaining({
      thinking: { display: "summarized" },
    }));
  });
});

describe("sanitizeUserSdkOptions B 组", () => {
  it("accepts boolean fields", () => {
    const opts = sanitizeUserSdkOptions({
      debug: true, strictMcpConfig: false, persistSession: true,
      includeHookEvents: false, forwardSubagentText: true,
      promptSuggestions: false, agentProgressSummaries: true,
      allowDangerouslySkipPermissions: false,
    });
    expect(opts.debug).toBe(true);
    expect(opts.persistSession).toBe(true);
    expect(opts.agentProgressSummaries).toBe(true);
  });
  it("rejects non-boolean values for boolean fields", () => {
    const opts = sanitizeUserSdkOptions({ debug: "yes" });
    expect(opts.debug).toBeUndefined();
  });
  it("accepts string fields", () => {
    const opts = sanitizeUserSdkOptions({
      title: "My Session", debugFile: "/tmp/debug.log",
      planModeInstructions: "Custom plan", permissionPromptToolName: "mcp__tool",
    });
    expect(opts.title).toBe("My Session");
  });
});

describe("sanitizeUserSdkOptions C 组", () => {
  it("accepts valid toolConfig", () => {
    const opts = sanitizeUserSdkOptions({ toolConfig: { askUserQuestion: { previewFormat: "html" } } });
    expect(opts.toolConfig).toEqual({ askUserQuestion: { previewFormat: "html" } });
  });
  it("accepts valid sandbox", () => {
    const opts = sanitizeUserSdkOptions({ sandbox: { enabled: true } });
    expect(opts.sandbox).toEqual({ enabled: true });
  });
  it("accepts valid toolAliases", () => {
    const opts = sanitizeUserSdkOptions({ toolAliases: { Bash: "mcp__workspace__bash" } });
    expect(opts.toolAliases).toEqual({ Bash: "mcp__workspace__bash" });
  });
  it("accepts settings as string or object", () => {
    expect(sanitizeUserSdkOptions({ settings: "/path.json" }).settings).toBe("/path.json");
    expect(sanitizeUserSdkOptions({ settings: { model: "test" } }).settings).toEqual({ model: "test" });
  });
});
