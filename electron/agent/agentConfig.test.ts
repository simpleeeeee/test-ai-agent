import { describe, expect, it } from "vitest";
import { loadAgentRuntimeConfig, sanitizeProcessEnv } from "./agentConfig.js";

describe("sanitizeProcessEnv", () => {
  it("removes official Anthropic environment variables before SDK launch", () => {
    const env = sanitizeProcessEnv({
      PATH: "C:/bin",
      SystemRoot: "C:/Windows",
      ANTHROPIC_API_KEY: "official-key",
      ANTHROPIC_AUTH_TOKEN: "old-token",
      ANTHROPIC_BASE_URL: "https://api.anthropic.com",
      ANTHROPIC_CUSTOM_HEADERS: "x-secret=1",
    });

    expect(env).toEqual({
      PATH: "C:/bin",
      SystemRoot: "C:/Windows",
    });
  });
});

describe("loadAgentRuntimeConfig", () => {
  it("builds SDK env from third-party gateway variables", () => {
    const config = loadAgentRuntimeConfig({
      cwd: "D:/pythonProject/test ai agent",
      env: {
        PATH: "C:/bin",
        AI_TEST_LLM_BASE_URL: "https://gateway.example.com/anthropic",
        AI_TEST_LLM_AUTH_TOKEN: "third-party-token",
        AI_TEST_LLM_MODEL: "claude-compatible-test-model",
        AI_TEST_LLM_CUSTOM_HEADERS_JSON: "{\"x-tenant\":\"qa\"}",
        AI_TEST_LLM_ENABLE_MODEL_DISCOVERY: "1",
      },
    });

    expect(config.gateway).toEqual({
      baseUrl: "https://gateway.example.com/anthropic",
      authToken: "third-party-token",
      model: "claude-compatible-test-model",
      customHeaders: { "x-tenant": "qa" },
      enableModelDiscovery: true,
    });
    expect(config.sanitizedEnv.ANTHROPIC_BASE_URL).toBe("https://gateway.example.com/anthropic");
    expect(config.sanitizedEnv.ANTHROPIC_AUTH_TOKEN).toBe("third-party-token");
    expect(config.sanitizedEnv.ANTHROPIC_CUSTOM_HEADERS).toBe("{\"x-tenant\":\"qa\"}");
    expect(config.sanitizedEnv.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY).toBe("1");
    expect(config.sdkOptions.model).toBe("claude-compatible-test-model");
  });

  it("fails fast when no third-party gateway base URL is configured", () => {
    expect(() => loadAgentRuntimeConfig({ cwd: "D:/repo", env: { AI_TEST_LLM_AUTH_TOKEN: "token" } }))
      .toThrow("AI_TEST_LLM_BASE_URL is required");
  });

  it("rejects official Anthropic endpoints", () => {
    expect(() => loadAgentRuntimeConfig({
      cwd: "D:/repo",
      env: {
        AI_TEST_LLM_BASE_URL: "https://api.anthropic.com",
        AI_TEST_LLM_AUTH_TOKEN: "token",
      },
    })).toThrow("Official Anthropic endpoints are not allowed");
  });
});
