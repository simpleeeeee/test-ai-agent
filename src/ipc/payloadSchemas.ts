import { z } from "zod";
import type { MainToRendererChannel, RendererToMainChannel } from "./channels.js";

const nonEmptyString = z.string().trim().min(1);
const jsonObject = z.record(z.string(), z.unknown());
const settingsFormValues = z.object({
  baseUrl: nonEmptyString,
  apiKey: nonEmptyString,
  model: nonEmptyString,
});

const noPayload = z.undefined().optional();

const rendererSchemas = {
  "run:create": z.object({ prompt: nonEmptyString }),
  "run:approve-plan": z.object({ runId: nonEmptyString }),
  "tool:approve": z.object({
    runId: nonEmptyString,
    requestId: nonEmptyString,
    updatedInput: jsonObject.optional(),
    applyPermissionSuggestions: z.boolean().optional(),
  }),
  "tool:deny": z.object({
    runId: nonEmptyString,
    requestId: nonEmptyString,
    message: nonEmptyString.optional(),
  }),
  "run:stop": z.object({ runId: nonEmptyString }),
  "run:resume": z.object({ runId: nonEmptyString, sessionId: nonEmptyString }),
  "run:fork": z.object({ runId: nonEmptyString, sessionId: nonEmptyString }),
  "run:continue": z.object({ runId: nonEmptyString }),
  "run:send-message": z.object({ runId: nonEmptyString, message: nonEmptyString }),
  "run:set-model": z.object({ runId: nonEmptyString, model: nonEmptyString }),
  "run:set-permission-mode": z.object({ runId: nonEmptyString, permissionMode: nonEmptyString }),
  "run:apply-settings": z.object({ runId: nonEmptyString, settings: jsonObject }),
  "run:list-sessions": noPayload,
  "run:get-session": z.object({ sessionId: nonEmptyString }),
  "run:get-session-messages": z.object({ sessionId: nonEmptyString }),
  "run:rename-session": z.object({ sessionId: nonEmptyString, title: nonEmptyString }),
  "run:tag-session": z.object({ sessionId: nonEmptyString, tag: z.string().nullable() }),
  "run:delete-session": z.object({ sessionId: nonEmptyString }),
  "mcp:set-servers": z.object({ runId: nonEmptyString, servers: jsonObject }),
  "mcp:reconnect": z.object({ runId: nonEmptyString, serverName: nonEmptyString }),
  "mcp:toggle": z.object({ runId: nonEmptyString, serverName: nonEmptyString, enabled: z.boolean() }),
  "mcp:status": z.object({ runId: nonEmptyString }),
  "question:answer": z.object({ runId: nonEmptyString, requestId: nonEmptyString, answers: jsonObject }),
  "task:stop": z.object({ runId: nonEmptyString, taskId: nonEmptyString }),
  "sdk:supported-models": z.object({ runId: nonEmptyString }),
  "sdk:supported-commands": z.object({ runId: nonEmptyString }),
  "sdk:supported-agents": z.object({ runId: nonEmptyString }),
  "sdk:account-info": z.object({ runId: nonEmptyString }),
  "sdk:initialization-result": z.object({ runId: nonEmptyString }),
  "settings:get": noPayload,
  "settings:save": settingsFormValues,
  "window:minimize": noPayload,
  "window:toggle-maximize": noPayload,
  "window:close": noPayload,
} satisfies Record<RendererToMainChannel, z.ZodTypeAny>;

const mainSchemas = {
  "assistant:text-delta": z.object({ runId: nonEmptyString, messageId: nonEmptyString, delta: z.string() }),
  "assistant:thinking-delta": z.object({ runId: nonEmptyString, messageId: nonEmptyString, delta: z.string() }),
  "assistant:message-completed": z.object({ runId: nonEmptyString, messageId: nonEmptyString }),
  "sdk:raw-message": z.object({ runId: nonEmptyString, message: z.unknown() }),
  "sdk:session-changed": z.object({ runId: nonEmptyString, sessionId: nonEmptyString }),
  "sdk:status": z.object({ runId: nonEmptyString, status: nonEmptyString, raw: z.unknown().optional() }),
  "sdk:usage": z.object({ runId: nonEmptyString, raw: z.unknown() }),
  "sdk:error": z.object({ runId: nonEmptyString.optional(), message: nonEmptyString, retryable: z.boolean() }),
  "sdk:permission-denied": z.object({ runId: nonEmptyString, toolName: nonEmptyString, raw: z.unknown().optional() }),
  "sdk:mcp-status": z.object({ runId: nonEmptyString, servers: z.array(z.unknown()) }),
  "sdk:task-progress": z.object({ runId: nonEmptyString, taskId: nonEmptyString, summary: z.string().optional(), raw: z.unknown().optional() }),
  "sdk:hook-event": z.object({ runId: nonEmptyString, hookName: nonEmptyString, raw: z.unknown() }),
  "question:required": z.object({ runId: nonEmptyString, requestId: nonEmptyString, questions: z.array(z.unknown()) }),
  "question:answered": z.object({ runId: nonEmptyString, requestId: nonEmptyString }),
} satisfies Partial<Record<MainToRendererChannel, z.ZodTypeAny>>;

export function parseRendererToMainPayload(channel: RendererToMainChannel, payload: unknown): unknown {
  return rendererSchemas[channel].parse(payload);
}

export function parseMainToRendererPayload(channel: MainToRendererChannel, payload: unknown): unknown {
  const schemas: Partial<Record<MainToRendererChannel, z.ZodTypeAny>> = mainSchemas;
  const schema = schemas[channel];
  return schema ? schema.parse(payload) : payload;
}
