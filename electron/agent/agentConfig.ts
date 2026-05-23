import { z } from "zod";

export type ThirdPartyAnthropicGatewayConfig = {
  baseUrl: string;
  authToken: string;
  model?: string;
  customHeaders: Record<string, string>;
  enableModelDiscovery: boolean;
};

export type AgentRuntimeConfig = {
  cwd: string;
  gateway: ThirdPartyAnthropicGatewayConfig;
  sdkOptions: Record<string, unknown>;
  sanitizedEnv: Record<string, string>;
};

const forbiddenAnthropicEnv = new Set([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_CUSTOM_HEADERS",
]);

const headersSchema = z.record(z.string(), z.string());

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

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }
  return headersSchema.parse(JSON.parse(raw));
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
  env?: NodeJS.ProcessEnv;
}): AgentRuntimeConfig {
  const env = input.env ?? process.env;
  const baseUrl = env.AI_TEST_LLM_BASE_URL?.trim();
  const authToken = env.AI_TEST_LLM_AUTH_TOKEN?.trim();

  if (!baseUrl) {
    throw new Error("AI_TEST_LLM_BASE_URL is required");
  }
  if (!authToken) {
    throw new Error("AI_TEST_LLM_AUTH_TOKEN is required");
  }
  assertThirdPartyBaseUrl(baseUrl);

  const customHeaders = parseHeaders(env.AI_TEST_LLM_CUSTOM_HEADERS_JSON);
  const enableModelDiscovery = env.AI_TEST_LLM_ENABLE_MODEL_DISCOVERY === "1";
  const model = env.AI_TEST_LLM_MODEL?.trim() || undefined;
  const sanitizedEnv = {
    ...sanitizeProcessEnv(env),
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: authToken,
    ANTHROPIC_CUSTOM_HEADERS: JSON.stringify(customHeaders),
    CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: enableModelDiscovery ? "1" : "0",
  };

  return {
    cwd: input.cwd,
    gateway: {
      baseUrl,
      authToken,
      model,
      customHeaders,
      enableModelDiscovery,
    },
    sanitizedEnv,
    sdkOptions: {
      cwd: input.cwd,
      model,
      env: sanitizedEnv,
      includePartialMessages: true,
      permissionMode: "default",
    },
  };
}
