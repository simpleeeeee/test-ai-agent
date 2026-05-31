# Claude Agent SDK Adapter Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Claude Agent SDK 审查报告中的事件映射、配置透传、IPC schema、前端状态和 UI 适配断点。

**Architecture:** 保持现有 Electron 主进程唯一调用 SDK 的边界，在 `runEventMapper` 中引入每次运行独立的 mapper session 来处理跨事件状态。主进程输出 typed IPC events，渲染进程通过 `sdkEventStore` 折叠为 UI 状态，设置面板只提交经过白名单校验的 SDK options。

**Tech Stack:** Electron、TypeScript、React 19、Vitest、React Testing Library、`@anthropic-ai/claude-agent-sdk`、Zod。

---

## Scope Notes

当前仓库已有未提交改动，执行计划前先运行：

```bash
git status --short
```

如果看到与本计划同一文件的未提交改动，先阅读差异并保留用户已有工作。不要执行 `git reset --hard` 或 `git checkout --`。

本计划对应 spec：

```text
docs/superpowers/specs/2026-05-31-claude-agent-sdk-adapter-audit-design.md
```

## File Map

**后端 SDK 事件与配置**

- Modify: `electron/agent/runEventMapper.ts` - 引入 `SdkRunEventMapperSession`，补齐 stream/result/system 事件映射。
- Modify: `electron/agent/runEventMapper.test.ts` - 覆盖 thinking、input_json_delta、message_start、message_delta、result metadata、system init/compact。
- Modify: `electron/agent/agentSessionManager.ts` - 每个 run 使用独立 mapper session，移除 message id 外部偷取逻辑，确认 resume/fork/continue 不注入用户 prompt。
- Modify: `electron/agent/agentSessionManager.test.ts` - 覆盖 mapper session 集成和恢复路径无污染。
- Modify: `electron/agent/agentConfig.ts` - 增加 SDK options 白名单、权限模式、thinking display、effort、tool choice、output config 等透传。
- Modify: `electron/agent/agentConfig.test.ts` - 覆盖配置合并与安全字段不可覆盖。
- Modify: `electron/agent/approvalBridge.ts` - 兼容 `AskUserQuestion`、`ask_user_question`、`askUserQuestion`。
- Modify: `electron/agent/approvalBridge.test.ts` - 覆盖工具名兼容。

**共享事件与 IPC 契约**

- Modify: `src/domain/testRun.ts` - 扩展 `RunEvent` union 和 `ToolCall` 字段。
- Modify: `src/ipc/channels.ts` - 增加 `assistant:message-started`、`tool:input-json-delta`、`sdk:system-event`。
- Modify: `src/ipc/channels.test.ts` - 覆盖新增 channel allowlist。
- Modify: `src/ipc/payloadSchemas.ts` - 增加新增 channel schema，扩展 `assistant:message-completed` 和 `sdk:usage`。
- Modify: `src/ipc/payloadSchemas.test.ts` - 覆盖新增 payload 和旧 payload 兼容。

**前端状态与 UI**

- Modify: `src/app/sdkUiTypes.ts` - 增加 run stats、permission denials、system events、streamed tool input 类型。
- Modify: `src/app/sdkEventStore.ts` - 消费新增事件，保存 thinking duration、usage metadata、tool input delta、permission denied、system event。
- Modify: `src/app/sdkEventStore.test.ts` - 覆盖新增 reducer 行为。
- Modify: `src/app/components/ThinkingBlock.tsx` - 支持无 thinking 文本但有 duration 的完成态显示。
- Modify: `src/app/components/ThinkingBlock.test.tsx` - 覆盖完成态显示。
- Modify: `src/app/components/MessageStream.tsx` - 根据 thinking 内容或 duration 渲染 `ThinkingBlock`。
- Modify: `src/app/components/MessageStream.test.tsx` - 覆盖 thinking duration-only 渲染。
- Modify: `src/app/components/ToolCallCard.tsx` - 展示流式工具输入。
- Modify: `src/app/components/ToolCallCard.test.tsx` - 覆盖工具参数增量预览。
- Modify: `src/app/components/ConversationPane.tsx` - 默认模型文案改为 `Claude Sonnet 4.6`。
- Modify: `src/app/components/ConversationPane.test.tsx` - 覆盖默认模型文案。
- Modify: `src/app/components/SettingsPanel.tsx` - 增加 SDK options 控件。
- Modify: `src/app/components/SettingsPanel.test.tsx` - 覆盖权限模式、effort、thinking display、高级 options。
- Modify: `src/app/backendBridge.ts` - 增加设置 payload 的桥接类型。
- Modify: `src/app/App.tsx` - 接入设置面板提交的新增配置。
- Modify: `src/app/App.test.tsx` - 覆盖设置提交路径。

## Task 1: Extend IPC and Shared Event Contracts

**Files:**
- Modify: `src/domain/testRun.ts`
- Modify: `src/ipc/channels.ts`
- Modify: `src/ipc/channels.test.ts`
- Modify: `src/ipc/payloadSchemas.ts`
- Modify: `src/ipc/payloadSchemas.test.ts`
- Modify: `src/app/sdkUiTypes.ts`

- [ ] **Step 1: Write failing channel allowlist tests**

Append these assertions to the existing `mainToRendererChannels` tests in `src/ipc/channels.test.ts`.

```ts
expect(isMainToRendererChannel("assistant:message-started")).toBe(true);
expect(isMainToRendererChannel("tool:input-json-delta")).toBe(true);
expect(isMainToRendererChannel("sdk:system-event")).toBe(true);
```

- [ ] **Step 2: Run channel tests and verify RED**

Run:

```bash
npm test -- src/ipc/channels.test.ts
```

Expected: FAIL because the three channels are not in `mainToRendererChannels`.

- [ ] **Step 3: Write failing payload schema tests**

Add these tests to `src/ipc/payloadSchemas.test.ts`.

```ts
it("accepts assistant message started payloads", () => {
  expect(parseMainToRendererPayload("assistant:message-started" as any, {
    runId: "run-1",
    messageId: "msg-1",
    model: "claude-sonnet-4-6",
    usage: { input_tokens: 12 },
  })).toEqual({
    runId: "run-1",
    messageId: "msg-1",
    model: "claude-sonnet-4-6",
    usage: { input_tokens: 12 },
  });
});

it("accepts thinking duration and stop reason on assistant completion", () => {
  expect(parseMainToRendererPayload("assistant:message-completed", {
    runId: "run-1",
    messageId: "msg-1",
    thinkingDuration: "1.45s",
    stopReason: "end_turn",
    result: "完成",
  })).toEqual({
    runId: "run-1",
    messageId: "msg-1",
    thinkingDuration: "1.45s",
    stopReason: "end_turn",
    result: "完成",
  });
});

it("accepts streamed tool input payloads", () => {
  expect(parseMainToRendererPayload("tool:input-json-delta" as any, {
    runId: "run-1",
    toolCallId: "toolu-1",
    delta: "{\"url\"",
    inputSummary: "{\"url\"",
  })).toEqual({
    runId: "run-1",
    toolCallId: "toolu-1",
    delta: "{\"url\"",
    inputSummary: "{\"url\"",
  });
});

it("accepts enriched usage payloads", () => {
  expect(parseMainToRendererPayload("sdk:usage", {
    runId: "run-1",
    raw: { input_tokens: 10 },
    modelUsage: { claude: { input_tokens: 10 } },
    cost: { total_cost_usd: 0.01 },
    durationMs: 1500,
    numTurns: 2,
    model: "claude-sonnet-4-6",
  })).toEqual({
    runId: "run-1",
    raw: { input_tokens: 10 },
    modelUsage: { claude: { input_tokens: 10 } },
    cost: { total_cost_usd: 0.01 },
    durationMs: 1500,
    numTurns: 2,
    model: "claude-sonnet-4-6",
  });
});

it("accepts SDK system events", () => {
  expect(parseMainToRendererPayload("sdk:system-event" as any, {
    runId: "run-1",
    subtype: "compact",
    raw: { type: "system", subtype: "compact" },
  })).toEqual({
    runId: "run-1",
    subtype: "compact",
    raw: { type: "system", subtype: "compact" },
  });
});
```

- [ ] **Step 4: Run payload schema tests and verify RED**

Run:

```bash
npm test -- src/ipc/payloadSchemas.test.ts
```

Expected: FAIL because the new channel names and expanded payload fields are not accepted.

- [ ] **Step 5: Extend channel allowlist**

Modify `src/ipc/channels.ts` so `mainToRendererChannels` includes these values near the existing assistant/tool/sdk events.

```ts
"assistant:message-started",
"tool:input-json-delta",
"sdk:system-event",
```

- [ ] **Step 6: Extend RunEvent and ToolCall types**

Modify `src/domain/testRun.ts`.

Add optional streamed input fields to `ToolCall`:

```ts
streamedInput?: string;
inputJsonDelta?: string;
```

Add these `RunEvent` union members:

```ts
| { type: "assistant:message-started"; messageId: string; model?: string; usage?: unknown }
| { type: "assistant:thinking-delta"; messageId: string; delta: string }
| { type: "assistant:message-completed"; messageId: string; thinkingDuration?: string; stopReason?: string; result?: string }
| { type: "tool:input-json-delta"; toolCallId: string; delta: string; inputSummary: string }
| { type: "sdk:usage"; raw: unknown; modelUsage?: unknown; cost?: unknown; durationMs?: number; numTurns?: number; model?: string }
| { type: "sdk:system-event"; subtype: string; raw: unknown }
```

Update the `applyRunEvent` switch to keep these SDK/UI-only events as no-ops for the domain model:

```ts
case "assistant:message-started":
case "assistant:thinking-delta":
case "tool:input-json-delta":
case "sdk:system-event":
  return run;
```

- [ ] **Step 7: Extend payload schemas**

Modify `src/ipc/payloadSchemas.ts`.

Add schemas:

```ts
const usageMetadata = z.object({
  runId: nonEmptyString,
  raw: z.unknown(),
  modelUsage: z.unknown().optional(),
  cost: z.unknown().optional(),
  durationMs: z.number().nonnegative().optional(),
  numTurns: z.number().int().nonnegative().optional(),
  model: z.string().optional(),
});
```

Add or replace entries in `mainSchemas`:

```ts
"assistant:message-started": z.object({
  runId: nonEmptyString,
  messageId: nonEmptyString,
  model: z.string().optional(),
  usage: z.unknown().optional(),
}),
"assistant:message-completed": z.object({
  runId: nonEmptyString,
  messageId: nonEmptyString,
  thinkingDuration: z.string().optional(),
  stopReason: z.string().optional(),
  result: z.string().optional(),
}),
"tool:input-json-delta": z.object({
  runId: nonEmptyString,
  toolCallId: nonEmptyString,
  delta: z.string(),
  inputSummary: z.string(),
}),
"sdk:usage": usageMetadata,
"sdk:system-event": z.object({
  runId: nonEmptyString,
  subtype: nonEmptyString,
  raw: z.unknown(),
}),
```

- [ ] **Step 8: Extend UI types**

Modify `src/app/sdkUiTypes.ts`.

Add:

```ts
export type RunStats = {
  model?: string;
  durationMs?: number;
  numTurns?: number;
  cost?: unknown;
  modelUsage?: unknown;
  stopReason?: string;
};

export type PermissionDenial = {
  toolName: string;
  raw?: unknown;
};

export type SdkSystemEvent = {
  subtype: string;
  raw: unknown;
};
```

Extend `SdkMessage`:

```ts
model?: string;
stopReason?: string;
```

Extend `SdkUiState`:

```ts
runStats?: RunStats;
permissionDenials: PermissionDenial[];
systemEvents: SdkSystemEvent[];
```

- [ ] **Step 9: Initialize new UI state fields**

Modify `createInitialSdkUiState()` in `src/app/sdkEventStore.ts`:

```ts
permissionDenials: [],
systemEvents: [],
```

- [ ] **Step 10: Run contract tests and verify GREEN**

Run:

```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts src/domain/testRun.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit contract changes**

Run:

```bash
git add src/domain/testRun.ts src/ipc/channels.ts src/ipc/channels.test.ts src/ipc/payloadSchemas.ts src/ipc/payloadSchemas.test.ts src/app/sdkUiTypes.ts src/app/sdkEventStore.ts
git commit -m "feat: 扩展 Claude Agent SDK 事件契约"
```

## Task 2: Add Stateful SDK Stream Event Mapping

**Files:**
- Modify: `electron/agent/runEventMapper.ts`
- Modify: `electron/agent/runEventMapper.test.ts`

- [ ] **Step 1: Write failing tests for message_start, thinking, and input_json_delta**

Add to `electron/agent/runEventMapper.test.ts`.

```ts
it("maps message_start metadata and keeps the stable assistant message id", () => {
  const mapper = new SdkRunEventMapperSession("run-1");

  const events = mapper.map({
    type: "stream_event",
    uuid: "uuid-1",
    event: {
      type: "message_start",
      message: {
        id: "msg-1",
        model: "claude-sonnet-4-6",
        usage: { input_tokens: 42 },
      },
    },
  });

  expect(events).toEqual([
    {
      type: "assistant:message-started",
      messageId: "msg-1",
      model: "claude-sonnet-4-6",
      usage: { input_tokens: 42 },
    },
    { type: "sdk:usage", raw: { input_tokens: 42 }, model: "claude-sonnet-4-6" },
    { type: "sdk:raw-message", runId: "run-1", message: expect.any(Object) },
  ]);
});

it("maps thinking deltas and emits duration on message stop", () => {
  const times = [1000, 2450];
  const mapper = new SdkRunEventMapperSession("run-1", () => times.shift() ?? 2450);

  mapper.map({
    type: "stream_event",
    uuid: "uuid-1",
    event: { type: "message_start", message: { id: "msg-1" } },
  });
  mapper.map({
    type: "stream_event",
    uuid: "uuid-2",
    event: { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
  });
  const deltaEvents = mapper.map({
    type: "stream_event",
    uuid: "uuid-3",
    event: { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "分析需求" } },
  });
  mapper.map({
    type: "stream_event",
    uuid: "uuid-4",
    event: { type: "content_block_stop", index: 0 },
  });
  const stopEvents = mapper.map({
    type: "stream_event",
    uuid: "uuid-5",
    event: { type: "message_stop" },
  });

  expect(deltaEvents[0]).toEqual({
    type: "assistant:thinking-delta",
    messageId: "msg-1",
    delta: "分析需求",
  });
  expect(stopEvents[0]).toEqual({
    type: "assistant:message-completed",
    messageId: "msg-1",
    thinkingDuration: "1.45s",
  });
});

it("maps streamed tool input JSON deltas to the active tool call", () => {
  const mapper = new SdkRunEventMapperSession("run-1");

  mapper.map({
    type: "stream_event",
    uuid: "uuid-1",
    event: {
      type: "content_block_start",
      index: 1,
      content_block: { type: "tool_use", id: "toolu-1", name: "mcp__browser__navigate", input: {} },
    },
  });
  const events = mapper.map({
    type: "stream_event",
    uuid: "uuid-2",
    event: { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{\"url\":\"https://" } },
  });

  expect(events[0]).toEqual({
    type: "tool:input-json-delta",
    toolCallId: "toolu-1",
    delta: "{\"url\":\"https://",
    inputSummary: "{\"url\":\"https://",
  });
});
```

- [ ] **Step 2: Run mapper tests and verify RED**

Run:

```bash
npm test -- electron/agent/runEventMapper.test.ts
```

Expected: FAIL because `SdkRunEventMapperSession` and new event mappings do not exist.

- [ ] **Step 3: Implement mapper session state**

Modify `electron/agent/runEventMapper.ts`.

Add types and class:

```ts
type BlockState = {
  type: string;
  toolCallId?: string;
  thinkingStartedAt?: number;
};

export class SdkRunEventMapperSession {
  private assistantMessageId: string | undefined;
  private readonly blocks = new Map<number, BlockState>();
  private readonly toolInputs = new Map<string, string>();
  private pendingThinkingDuration: string | undefined;
  private stopReason: string | undefined;

  constructor(
    private readonly runId: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  map(message: any): RunEvent[] {
    return mapSdkMessageWithSession(this, this.runId, message);
  }

  setAssistantMessageId(messageId: string | undefined) {
    this.assistantMessageId = messageId;
  }

  messageId(fallback?: string) {
    return this.assistantMessageId ?? fallback ?? "assistant-message";
  }

  setBlock(index: number, state: BlockState) {
    this.blocks.set(index, state);
  }

  block(index: number) {
    return this.blocks.get(index);
  }

  appendToolInput(toolCallId: string, delta: string) {
    const next = `${this.toolInputs.get(toolCallId) ?? ""}${delta}`;
    this.toolInputs.set(toolCallId, next);
    return next;
  }

  beginThinking(index: number) {
    this.setBlock(index, { type: "thinking", thinkingStartedAt: this.now() });
  }

  finishBlock(index: number) {
    const block = this.blocks.get(index);
    if (block?.type === "thinking" && typeof block.thinkingStartedAt === "number") {
      this.pendingThinkingDuration = formatDuration(this.now() - block.thinkingStartedAt);
    }
    this.blocks.delete(index);
  }

  takeThinkingDuration() {
    const duration = this.pendingThinkingDuration;
    this.pendingThinkingDuration = undefined;
    return duration;
  }

  setStopReason(reason: string | undefined) {
    this.stopReason = reason;
  }

  takeStopReason() {
    const reason = this.stopReason;
    this.stopReason = undefined;
    return reason;
  }
}
```

Add helper:

```ts
function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}
```

- [ ] **Step 4: Implement stream event mapping with session**

In `electron/agent/runEventMapper.ts`, add:

```ts
function mapSdkMessageWithSession(session: SdkRunEventMapperSession, runId: string, message: any): RunEvent[] {
  const events: RunEvent[] = [];

  if (message.type === "stream_event") {
    const sdkEvent = message.event;

    if (sdkEvent?.type === "message_start") {
      const messageId = typeof sdkEvent.message?.id === "string" ? sdkEvent.message.id : message.uuid;
      session.setAssistantMessageId(messageId);
      events.push({
        type: "assistant:message-started",
        messageId,
        ...(typeof sdkEvent.message?.model === "string" ? { model: sdkEvent.message.model } : {}),
        ...(sdkEvent.message?.usage ? { usage: sdkEvent.message.usage } : {}),
      });
      if (sdkEvent.message?.usage) {
        events.push({
          type: "sdk:usage",
          raw: sdkEvent.message.usage,
          ...(typeof sdkEvent.message?.model === "string" ? { model: sdkEvent.message.model } : {}),
        });
      }
    }

    if (sdkEvent?.type === "content_block_start") {
      const index = typeof sdkEvent.index === "number" ? sdkEvent.index : 0;
      const block = sdkEvent.content_block;
      if (block?.type === "thinking") {
        session.beginThinking(index);
      }
      if (block?.type === "text") {
        session.setBlock(index, { type: "text" });
      }
      if (block?.type === "tool_use" || block?.type === "server_tool_use") {
        const toolCallId = block.id ?? `tool-${index}`;
        const toolName = block.name ?? block.type;
        session.setBlock(index, { type: block.type, toolCallId });
        events.push({
          type: "tool:call-started",
          toolCall: {
            id: toolCallId,
            toolName,
            label: `调用 ${toolName}`,
            status: "running",
            inputSummary: summarize(block.input ?? {}),
          },
        });
      }
    }

    if (sdkEvent?.type === "content_block_delta") {
      const index = typeof sdkEvent.index === "number" ? sdkEvent.index : 0;
      const delta = sdkEvent.delta;
      if (delta?.type === "text_delta") {
        events.push({ type: "assistant:text-delta", messageId: session.messageId(message.uuid), delta: delta.text ?? "" });
      }
      if (delta?.type === "thinking_delta") {
        events.push({ type: "assistant:thinking-delta", messageId: session.messageId(message.uuid), delta: delta.thinking ?? delta.text ?? "" });
      }
      if (delta?.type === "input_json_delta") {
        const block = session.block(index);
        if (block?.toolCallId) {
          const partial = delta.partial_json ?? "";
          const inputSummary = session.appendToolInput(block.toolCallId, partial);
          events.push({ type: "tool:input-json-delta", toolCallId: block.toolCallId, delta: partial, inputSummary });
        }
      }
    }

    if (sdkEvent?.type === "content_block_stop") {
      const index = typeof sdkEvent.index === "number" ? sdkEvent.index : 0;
      session.finishBlock(index);
    }

    if (sdkEvent?.type === "message_delta") {
      session.setStopReason(typeof sdkEvent.delta?.stop_reason === "string" ? sdkEvent.delta.stop_reason : undefined);
      if (sdkEvent.usage) {
        events.push({ type: "sdk:usage", raw: sdkEvent.usage });
      }
    }

    if (sdkEvent?.type === "message_stop") {
      const thinkingDuration = session.takeThinkingDuration();
      const stopReason = session.takeStopReason();
      events.push({
        type: "assistant:message-completed",
        messageId: session.messageId(message.uuid),
        ...(thinkingDuration ? { thinkingDuration } : {}),
        ...(stopReason ? { stopReason } : {}),
      });
    }
  }

  events.push(...mapNonStreamSdkMessage(runId, message));
  events.push(raw(runId, message));
  return events;
}
```

- [ ] **Step 5: Preserve legacy mapper function**

Replace the current body of `mapSdkMessageToRunEvents()` with:

```ts
export function mapSdkMessageToRunEvents(runId: string, message: any, assistantMessageId?: string): RunEvent[] {
  const session = new SdkRunEventMapperSession(runId);
  session.setAssistantMessageId(assistantMessageId);
  return session.map(message);
}
```

Create `mapNonStreamSdkMessage()` by moving existing result/system logic out of `mapSdkMessageToRunEvents()` and removing the extra `raw()` push from that helper.

- [ ] **Step 6: Run mapper tests and verify GREEN**

Run:

```bash
npm test -- electron/agent/runEventMapper.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit mapper stream changes**

Run:

```bash
git add electron/agent/runEventMapper.ts electron/agent/runEventMapper.test.ts src/domain/testRun.ts
git commit -m "feat: 补齐 SDK 流式事件映射"
```

## Task 3: Map Result and System Metadata

**Files:**
- Modify: `electron/agent/runEventMapper.ts`
- Modify: `electron/agent/runEventMapper.test.ts`

- [ ] **Step 1: Write failing tests for result metadata**

Add to `electron/agent/runEventMapper.test.ts`.

```ts
it("maps result metadata, result fallback text, and permission denials", () => {
  const mapper = new SdkRunEventMapperSession("run-1");
  const events = mapper.map({
    type: "result",
    subtype: "success",
    session_id: "session-1",
    usage: { input_tokens: 10, output_tokens: 5 },
    modelUsage: { claude: { input_tokens: 10 } },
    cost: { total_cost_usd: 0.02 },
    duration_ms: 2300,
    permission_denials: [{ tool_name: "Write", reason: "blocked" }],
    result: "最终回复",
    num_turns: 3,
  });

  expect(events).toEqual([
    { type: "sdk:session-changed", sessionId: "session-1" },
    {
      type: "sdk:usage",
      raw: { input_tokens: 10, output_tokens: 5 },
      modelUsage: { claude: { input_tokens: 10 } },
      cost: { total_cost_usd: 0.02 },
      durationMs: 2300,
      numTurns: 3,
    },
    { type: "sdk:permission-denied", toolName: "Write", raw: { tool_name: "Write", reason: "blocked" } },
    { type: "assistant:text-delta", messageId: "result-session-1", delta: "最终回复" },
    { type: "assistant:message-completed", messageId: "result-session-1", result: "最终回复" },
    { type: "run:status-changed", status: "completed" },
    { type: "sdk:raw-message", runId: "run-1", message: expect.any(Object) },
  ]);
});
```

- [ ] **Step 2: Write failing tests for system init and compact**

Add to `electron/agent/runEventMapper.test.ts`.

```ts
it("maps SDK system init and compact events", () => {
  const mapper = new SdkRunEventMapperSession("run-1");

  expect(mapper.map({ type: "system", subtype: "init", cwd: "D:/project" })[0]).toEqual({
    type: "sdk:system-event",
    subtype: "init",
    raw: { type: "system", subtype: "init", cwd: "D:/project" },
  });

  expect(mapper.map({ type: "system", subtype: "compact", summary: "已压缩上下文" })[0]).toEqual({
    type: "sdk:system-event",
    subtype: "compact",
    raw: { type: "system", subtype: "compact", summary: "已压缩上下文" },
  });
});
```

- [ ] **Step 3: Run mapper tests and verify RED**

Run:

```bash
npm test -- electron/agent/runEventMapper.test.ts
```

Expected: FAIL because result metadata and generic system events are not fully mapped.

- [ ] **Step 4: Implement enriched result mapping**

In `mapNonStreamSdkMessage()` inside `electron/agent/runEventMapper.ts`, implement:

```ts
if (message.type === "result") {
  const resultMessageId = typeof message.session_id === "string"
    ? `result-${message.session_id}`
    : `result-${runId}`;

  if (typeof message.session_id === "string") {
    events.push({ type: "sdk:session-changed", sessionId: message.session_id });
  }

  if (message.usage || message.modelUsage || message.cost || typeof message.duration_ms === "number" || typeof message.num_turns === "number") {
    events.push({
      type: "sdk:usage",
      raw: message.usage ?? {},
      ...(message.modelUsage ? { modelUsage: message.modelUsage } : {}),
      ...(message.cost ? { cost: message.cost } : {}),
      ...(typeof message.duration_ms === "number" ? { durationMs: message.duration_ms } : {}),
      ...(typeof message.num_turns === "number" ? { numTurns: message.num_turns } : {}),
      ...(typeof message.model === "string" ? { model: message.model } : {}),
    });
  }

  if (Array.isArray(message.permission_denials)) {
    for (const denial of message.permission_denials) {
      const toolName = typeof denial?.tool_name === "string"
        ? denial.tool_name
        : typeof denial?.toolName === "string"
          ? denial.toolName
          : "unknown";
      events.push({ type: "sdk:permission-denied", toolName, raw: denial });
    }
  }

  if (typeof message.result === "string" && message.result.length > 0) {
    events.push({ type: "assistant:text-delta", messageId: resultMessageId, delta: message.result });
    events.push({ type: "assistant:message-completed", messageId: resultMessageId, result: message.result });
  }

  if (message.subtype === "error") {
    events.push({
      type: "sdk:error",
      message: typeof message.error === "string" ? message.error : "SDK 执行错误",
      retryable: false,
      raw: message,
    });
    events.push({ type: "run:status-changed", status: "failed" });
  } else {
    events.push({ type: "run:status-changed", status: message.subtype === "success" ? "completed" : "failed" });
  }
}
```

- [ ] **Step 5: Implement generic system event mapping**

In `mapNonStreamSdkMessage()` after existing task and MCP cases:

```ts
if (message.type === "system" && typeof message.subtype === "string") {
  if (message.subtype !== "task_progress" && message.subtype !== "mcp_server_status") {
    events.push({
      type: "sdk:system-event",
      subtype: message.subtype,
      raw: message,
    });
  }
}
```

- [ ] **Step 6: Run mapper tests and verify GREEN**

Run:

```bash
npm test -- electron/agent/runEventMapper.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit result/system mapping**

Run:

```bash
git add electron/agent/runEventMapper.ts electron/agent/runEventMapper.test.ts
git commit -m "feat: 映射 SDK 结果元数据和系统事件"
```

## Task 4: Integrate Mapper Session in AgentSessionManager

**Files:**
- Modify: `electron/agent/agentSessionManager.ts`
- Modify: `electron/agent/agentSessionManager.test.ts`

- [ ] **Step 1: Write failing integration test for thinking duration**

Add to `electron/agent/agentSessionManager.test.ts`.

```ts
it("uses one mapper session per run so thinking duration spans multiple SDK events", async () => {
  async function* messages() {
    yield { type: "stream_event", uuid: "u1", event: { type: "message_start", message: { id: "msg-1" } } };
    yield { type: "stream_event", uuid: "u2", event: { type: "content_block_start", index: 0, content_block: { type: "thinking" } } };
    yield { type: "stream_event", uuid: "u3", event: { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "分析" } } };
    yield { type: "stream_event", uuid: "u4", event: { type: "content_block_stop", index: 0 } };
    yield { type: "stream_event", uuid: "u5", event: { type: "message_stop" } };
    yield { type: "result", subtype: "success" };
  }

  const emit = vi.fn();
  const adapter = { start: vi.fn(() => ({ messages: messages(), close: vi.fn() })) };
  const manager = new AgentSessionManager({
    adapter: adapter as any,
    loadConfig: () => ({ sdkOptions: {} }),
    emit,
  });

  await manager.startRun("run-1", "测试");

  expect(emit).toHaveBeenCalledWith("assistant:thinking-delta", expect.objectContaining({
    runId: "run-1",
    messageId: "msg-1",
    delta: "分析",
  }));
  expect(emit).toHaveBeenCalledWith("assistant:message-completed", expect.objectContaining({
    runId: "run-1",
    messageId: "msg-1",
    thinkingDuration: expect.stringMatching(/s$/),
  }));
});
```

- [ ] **Step 2: Strengthen resume/fork/continue no-prompt assertions**

Update existing resume/fork/continue tests in `electron/agent/agentSessionManager.test.ts` to also assert `adapter.start` receives no seeded user message before the SDK emits output. Keep the existing timeout pattern that expects `"__timeout__"`.

- [ ] **Step 3: Run manager tests and verify RED**

Run:

```bash
npm test -- electron/agent/agentSessionManager.test.ts
```

Expected: FAIL because `drainMessages()` still calls stateless `mapSdkMessageToRunEvents()`.

- [ ] **Step 4: Use SdkRunEventMapperSession in drainMessages**

Modify imports in `electron/agent/agentSessionManager.ts`:

```ts
import { SdkRunEventMapperSession } from "./runEventMapper.js";
```

Replace `drainMessages()` with:

```ts
private async drainMessages(runId: string, messages: AsyncIterable<unknown>) {
  const mapper = new SdkRunEventMapperSession(runId);
  for await (const message of messages) {
    for (const event of mapper.map(message)) {
      this.emitRunEvent(runId, event);
    }
  }
}
```

Remove the old `isAssistantMessageStart()` helper if it becomes unused.

- [ ] **Step 5: Keep resume/fork/continue prompts silent**

Confirm these methods in `electron/agent/agentSessionManager.ts` call `startRun()` with an empty prompt string and resume/continue options:

```ts
return this.startRun(runId, "", { resume: sessionId });
return this.startRun(runId, "", { resume: newSessionId });
return this.startRun(runId, "", { continue: true });
```

Do not push any user message for resume/fork/continue.

- [ ] **Step 6: Run manager tests and verify GREEN**

Run:

```bash
npm test -- electron/agent/agentSessionManager.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit manager integration**

Run:

```bash
git add electron/agent/agentSessionManager.ts electron/agent/agentSessionManager.test.ts
git commit -m "fix: 使用有状态 mapper 处理 SDK 会话事件"
```

## Task 5: Support AskUserQuestion Tool Name Variants

**Files:**
- Modify: `electron/agent/approvalBridge.ts`
- Modify: `electron/agent/approvalBridge.test.ts`

- [ ] **Step 1: Write failing tests for snake_case and camelCase tool names**

Add to `electron/agent/approvalBridge.test.ts`.

```ts
it.each(["ask_user_question", "askUserQuestion"])("emits question requests for %s", async (toolName) => {
  const emit = vi.fn();
  const bridge = new ApprovalBridge("run-1", emit);
  const decision = bridge.canUseTool(toolName, {
    questions: [{ question: "选择环境", options: [{ label: "QA" }] }],
  }, {
    signal: new AbortController().signal,
    suggestions: [],
  });

  expect(emit).toHaveBeenCalledWith({
    type: "question:required",
    requestId: "approval-1",
    questions: [{ question: "选择环境", options: [{ label: "QA" }] }],
  });

  bridge.answerQuestion("approval-1", { "选择环境": "QA" });
  await expect(decision).resolves.toEqual({
    behavior: "allow",
    updatedInput: {
      questions: [{ question: "选择环境", options: [{ label: "QA" }] }],
      answers: { "选择环境": "QA" },
    },
  });
});
```

- [ ] **Step 2: Run approval tests and verify RED**

Run:

```bash
npm test -- electron/agent/approvalBridge.test.ts
```

Expected: FAIL because only `AskUserQuestion` is recognized.

- [ ] **Step 3: Implement tool name normalization**

Modify `electron/agent/approvalBridge.ts`.

Add helper:

```ts
function isAskUserQuestionTool(toolName: string): boolean {
  return ["AskUserQuestion", "ask_user_question", "askUserQuestion"].includes(toolName);
}
```

Replace:

```ts
if (toolName === "AskUserQuestion") {
```

with:

```ts
if (isAskUserQuestionTool(toolName)) {
```

- [ ] **Step 4: Run approval tests and verify GREEN**

Run:

```bash
npm test -- electron/agent/approvalBridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit approval compatibility**

Run:

```bash
git add electron/agent/approvalBridge.ts electron/agent/approvalBridge.test.ts
git commit -m "fix: 兼容用户提问工具名称格式"
```

## Task 6: Add Safe SDK Option Merging

**Files:**
- Modify: `electron/agent/agentConfig.ts`
- Modify: `electron/agent/agentConfig.test.ts`
- Modify: `src/ipc/payloadSchemas.ts`
- Modify: `src/ipc/payloadSchemas.test.ts`

- [ ] **Step 1: Write failing tests for SDK option defaults and overrides**

Add to `electron/agent/agentConfig.test.ts`.

```ts
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
```

- [ ] **Step 2: Run config tests and verify RED**

Run:

```bash
npm test -- electron/agent/agentConfig.test.ts
```

Expected: FAIL because `userSdkOptions` and default thinking config are not supported.

- [ ] **Step 3: Implement SDK option types and merge helper**

Modify `electron/agent/agentConfig.ts`.

Add:

```ts
type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";
type ThinkingEffort = "low" | "medium" | "high" | "xhigh" | "max";
type ThinkingDisplay = "summarized" | "omitted";

export type UserSdkOptions = {
  permissionMode?: PermissionMode;
  maxTurns?: number;
  additionalDirectories?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  agents?: Record<string, unknown>;
  skills?: Record<string, unknown> | string[];
  hooks?: Record<string, unknown>;
  tools?: unknown[];
  mcpServers?: Record<string, unknown>;
  systemPrompt?: string;
  thinking?: { effort?: ThinkingEffort; display?: ThinkingDisplay };
  toolChoice?: unknown;
  outputConfig?: unknown;
  contextEditing?: unknown;
  compaction?: unknown;
  promptCaching?: unknown;
};

const permissionModes = new Set(["default", "acceptEdits", "bypassPermissions", "plan"]);
const thinkingEfforts = new Set(["low", "medium", "high", "xhigh", "max"]);
const thinkingDisplays = new Set(["summarized", "omitted"]);
```

Add merge helper:

```ts
function sanitizeUserSdkOptions(input: unknown): UserSdkOptions {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const options: UserSdkOptions = {};

  if (typeof source.permissionMode === "string" && permissionModes.has(source.permissionMode)) {
    options.permissionMode = source.permissionMode as PermissionMode;
  }
  if (Number.isInteger(source.maxTurns) && (source.maxTurns as number) > 0) {
    options.maxTurns = source.maxTurns as number;
  }
  if (Array.isArray(source.additionalDirectories) && source.additionalDirectories.every((value) => typeof value === "string")) {
    options.additionalDirectories = source.additionalDirectories;
  }
  if (Array.isArray(source.allowedTools) && source.allowedTools.every((value) => typeof value === "string")) {
    options.allowedTools = source.allowedTools;
  }
  if (Array.isArray(source.disallowedTools) && source.disallowedTools.every((value) => typeof value === "string")) {
    options.disallowedTools = source.disallowedTools;
  }
  if (source.agents && typeof source.agents === "object" && !Array.isArray(source.agents)) options.agents = source.agents as Record<string, unknown>;
  if (source.skills && (Array.isArray(source.skills) || typeof source.skills === "object")) options.skills = source.skills as UserSdkOptions["skills"];
  if (source.hooks && typeof source.hooks === "object" && !Array.isArray(source.hooks)) options.hooks = source.hooks as Record<string, unknown>;
  if (Array.isArray(source.tools)) options.tools = source.tools;
  if (source.mcpServers && typeof source.mcpServers === "object" && !Array.isArray(source.mcpServers)) options.mcpServers = source.mcpServers as Record<string, unknown>;
  if (typeof source.systemPrompt === "string") options.systemPrompt = source.systemPrompt;
  if (source.thinking && typeof source.thinking === "object") {
    const thinking = source.thinking as Record<string, unknown>;
    options.thinking = {
      ...(typeof thinking.effort === "string" && thinkingEfforts.has(thinking.effort) ? { effort: thinking.effort as ThinkingEffort } : {}),
      ...(typeof thinking.display === "string" && thinkingDisplays.has(thinking.display) ? { display: thinking.display as ThinkingDisplay } : {}),
    };
  }
  if (source.toolChoice !== undefined) options.toolChoice = source.toolChoice;
  if (source.outputConfig !== undefined) options.outputConfig = source.outputConfig;
  if (source.contextEditing !== undefined) options.contextEditing = source.contextEditing;
  if (source.compaction !== undefined) options.compaction = source.compaction;
  if (source.promptCaching !== undefined) options.promptCaching = source.promptCaching;

  return options;
}
```

- [ ] **Step 4: Add userSdkOptions input and safe merge**

Modify the `loadAgentRuntimeConfig` input type:

```ts
userSdkOptions?: unknown;
```

In the returned `sdkOptions`, merge sanitized user options between base values and safety overrides:

```ts
const userSdkOptions = sanitizeUserSdkOptions(input.userSdkOptions);
const thinking = {
  display: "summarized",
  ...(userSdkOptions.thinking ?? {}),
};

return {
  cwd: input.cwd,
  sdkOptions: {
    ...userSdkOptions,
    cwd: input.cwd,
    ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
    includePartialMessages: true,
    permissionMode: userSdkOptions.permissionMode ?? "default",
    thinking,
    ...(input.claudeConfigDir ? { env: { CLAUDE_CONFIG_DIR: input.claudeConfigDir } } : {}),
  },
};
```

- [ ] **Step 5: Extend run:apply-settings payload schema**

Modify `src/ipc/payloadSchemas.ts` by replacing `run:apply-settings` schema with a shape that accepts SDK settings but still requires `runId`:

```ts
"run:apply-settings": z.object({
  runId: nonEmptyString,
  settings: jsonObject,
}),
```

Keep this broad enough for advanced SDK options, because `agentConfig.ts` performs the SDK whitelist.

- [ ] **Step 6: Run config and payload tests and verify GREEN**

Run:

```bash
npm test -- electron/agent/agentConfig.test.ts src/ipc/payloadSchemas.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit SDK option merge**

Run:

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts src/ipc/payloadSchemas.ts src/ipc/payloadSchemas.test.ts
git commit -m "feat: 增加 SDK 运行配置白名单"
```

## Task 7: Consume New Events in Frontend Store

**Files:**
- Modify: `src/app/sdkEventStore.ts`
- Modify: `src/app/sdkEventStore.test.ts`
- Modify: `src/app/sdkUiTypes.ts`

- [ ] **Step 1: Write failing reducer tests**

Add to `src/app/sdkEventStore.test.ts`.

```ts
it("stores assistant message metadata from message_start", () => {
  const state = reduceSdkUiEvent(createInitialSdkUiState(), {
    channel: "assistant:message-started" as any,
    payload: { runId: "run-1", messageId: "msg-1", model: "claude-sonnet-4-6", usage: { input_tokens: 12 } },
  });

  expect(state.activeRunId).toBe("run-1");
  expect(state.modelName).toBe("claude-sonnet-4-6");
  expect(state.usage).toEqual({ inputTokens: 12, outputTokens: 0 });
  expect(state.messages).toEqual([
    { id: "msg-1", role: "assistant", content: "", complete: false, model: "claude-sonnet-4-6" },
  ]);
});

it("stores completion metadata on assistant messages and run stats", () => {
  let state = createInitialSdkUiState();
  state = reduceSdkUiEvent(state, {
    channel: "assistant:thinking-delta",
    payload: { runId: "run-1", messageId: "msg-1", delta: "分析" },
  });
  state = reduceSdkUiEvent(state, {
    channel: "assistant:message-completed",
    payload: { runId: "run-1", messageId: "msg-1", thinkingDuration: "1.45s", stopReason: "end_turn", result: "完成" },
  });

  expect(state.messages[0]).toEqual({
    id: "msg-1",
    role: "assistant",
    content: "",
    complete: true,
    thinkingContent: "分析",
    thinkingDuration: "1.45s",
    stopReason: "end_turn",
  });
  expect(state.runStats?.stopReason).toBe("end_turn");
});

it("stores streamed tool input, enriched usage, permission denials, and system events", () => {
  let state = createInitialSdkUiState();
  state = reduceSdkUiEvent(state, {
    channel: "tool:approval-required",
    payload: {
      runId: "run-1",
      requestId: "req-1",
      toolCall: { id: "toolu-1", toolName: "mcp__browser__navigate", label: "导航", status: "waiting_approval" },
    },
  });
  state = reduceSdkUiEvent(state, {
    channel: "tool:input-json-delta" as any,
    payload: { runId: "run-1", toolCallId: "toolu-1", delta: "{\"url\"", inputSummary: "{\"url\"" },
  });
  state = reduceSdkUiEvent(state, {
    channel: "sdk:usage",
    payload: { runId: "run-1", raw: { input_tokens: 1 }, cost: { total_cost_usd: 0.01 }, durationMs: 100, numTurns: 2, model: "claude" },
  });
  state = reduceSdkUiEvent(state, {
    channel: "sdk:permission-denied",
    payload: { runId: "run-1", toolName: "Write", raw: { reason: "blocked" } },
  });
  state = reduceSdkUiEvent(state, {
    channel: "sdk:system-event" as any,
    payload: { runId: "run-1", subtype: "compact", raw: { type: "system", subtype: "compact" } },
  });

  expect(state.approvals[0].toolCall.inputSummary).toBe("{\"url\"");
  expect(state.approvals[0].toolCall.streamedInput).toBe("{\"url\"");
  expect(state.runStats).toEqual({
    model: "claude",
    durationMs: 100,
    numTurns: 2,
    cost: { total_cost_usd: 0.01 },
  });
  expect(state.permissionDenials).toEqual([{ toolName: "Write", raw: { reason: "blocked" } }]);
  expect(state.systemEvents).toEqual([{ subtype: "compact", raw: { type: "system", subtype: "compact" } }]);
});
```

- [ ] **Step 2: Run store tests and verify RED**

Run:

```bash
npm test -- src/app/sdkEventStore.test.ts
```

Expected: FAIL because reducer cases and state fields are missing.

- [ ] **Step 3: Consume assistant:message-started**

Modify `src/app/sdkEventStore.ts`.

Add before text delta handling:

```ts
if (event.channel === "assistant:message-started") {
  const messageId = String(payload.messageId);
  const model = typeof payload.model === "string" ? payload.model : undefined;
  const existing = state.messages.find((message) => message.id === messageId);
  const messages = existing
    ? state.messages.map((message) => message.id === messageId ? { ...message, ...(model ? { model } : {}) } : message)
    : [...state.messages, { id: messageId, role: "assistant" as const, content: "", complete: false, ...(model ? { model } : {}) }];
  return {
    ...state,
    activeRunId,
    messages,
    ...(model ? { modelName: model, runStats: { ...state.runStats, model } } : {}),
    ...(payload.usage ? { usage: normalizeUsage(payload.usage) } : {}),
  };
}
```

- [ ] **Step 4: Extend completion handling**

Replace the existing `assistant:message-completed` branch with:

```ts
if (event.channel === "assistant:message-completed") {
  const messageId = String(payload.messageId);
  const thinkingDuration = typeof payload.thinkingDuration === "string" ? payload.thinkingDuration : undefined;
  const stopReason = typeof payload.stopReason === "string" ? payload.stopReason : undefined;
  return {
    ...state,
    activeRunId,
    runStats: { ...state.runStats, ...(stopReason ? { stopReason } : {}) },
    messages: state.messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            complete: true,
            ...(thinkingDuration !== undefined ? { thinkingDuration } : {}),
            ...(stopReason !== undefined ? { stopReason } : {}),
          }
        : message,
    ),
  };
}
```

- [ ] **Step 5: Consume tool input delta**

Add branch:

```ts
if (event.channel === "tool:input-json-delta") {
  const toolCallId = String(payload.toolCallId);
  const inputSummary = typeof payload.inputSummary === "string" ? payload.inputSummary : "";
  const approvals = state.approvals.map((approval) =>
    approval.toolCall.id === toolCallId
      ? { ...approval, toolCall: { ...approval.toolCall, inputSummary, streamedInput: inputSummary } }
      : approval,
  );
  return { ...state, activeRunId, approvals };
}
```

- [ ] **Step 6: Consume enriched usage, permission denial, and system events**

Replace `sdk:usage` branch with:

```ts
if (event.channel === "sdk:usage") {
  return {
    ...state,
    activeRunId,
    usage: normalizeUsage(payload.raw),
    runStats: {
      ...state.runStats,
      ...(typeof payload.model === "string" ? { model: payload.model } : {}),
      ...(typeof payload.durationMs === "number" ? { durationMs: payload.durationMs } : {}),
      ...(typeof payload.numTurns === "number" ? { numTurns: payload.numTurns } : {}),
      ...(payload.cost !== undefined ? { cost: payload.cost } : {}),
      ...(payload.modelUsage !== undefined ? { modelUsage: payload.modelUsage } : {}),
    },
    ...(typeof payload.model === "string" ? { modelName: payload.model } : {}),
  };
}
```

Add:

```ts
if (event.channel === "sdk:permission-denied") {
  const denial = { toolName: String(payload.toolName), raw: payload.raw };
  return {
    ...state,
    activeRunId,
    permissionDenials: state.permissionDenials.length >= 200
      ? [...state.permissionDenials.slice(-199), denial]
      : [...state.permissionDenials, denial],
    errors: state.errors.length >= 200
      ? [...state.errors.slice(-199), { message: `权限被拒绝：${denial.toolName}`, retryable: false }]
      : [...state.errors, { message: `权限被拒绝：${denial.toolName}`, retryable: false }],
  };
}

if (event.channel === "sdk:system-event") {
  const systemEvent = { subtype: String(payload.subtype), raw: payload.raw };
  return {
    ...state,
    activeRunId,
    systemEvents: state.systemEvents.length >= 200
      ? [...state.systemEvents.slice(-199), systemEvent]
      : [...state.systemEvents, systemEvent],
  };
}
```

- [ ] **Step 7: Run store tests and verify GREEN**

Run:

```bash
npm test -- src/app/sdkEventStore.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit store changes**

Run:

```bash
git add src/app/sdkEventStore.ts src/app/sdkEventStore.test.ts src/app/sdkUiTypes.ts src/domain/testRun.ts
git commit -m "feat: 前端消费 SDK 扩展事件"
```

## Task 8: Update Thinking and Tool UI

**Files:**
- Modify: `src/app/components/ThinkingBlock.tsx`
- Modify: `src/app/components/ThinkingBlock.test.tsx`
- Modify: `src/app/components/MessageStream.tsx`
- Modify: `src/app/components/MessageStream.test.tsx`
- Modify: `src/app/components/ToolCallCard.tsx`
- Modify: `src/app/components/ToolCallCard.test.tsx`
- Modify: `src/app/components/ConversationPane.tsx`
- Modify: `src/app/components/ConversationPane.test.tsx`

- [ ] **Step 1: Write failing ThinkingBlock completion test**

Add to `src/app/components/ThinkingBlock.test.tsx`.

```tsx
it("shows completed thinking copy when duration exists without content", () => {
  render(<ThinkingBlock duration="1.45s"> </ThinkingBlock>);

  expect(screen.getByText("思考已完成")).toBeInTheDocument();
  expect(screen.getByText("1.45s")).toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing MessageStream duration-only test**

Add to `src/app/components/MessageStream.test.tsx`.

```tsx
it("renders a thinking block when only thinking duration is present", () => {
  render(
    <MessageStream
      state={{
        ...createInitialSdkUiState(),
        messages: [{ id: "msg-1", role: "assistant", content: "完成", complete: true, thinkingDuration: "1.45s" }],
      }}
      onApprove={vi.fn()}
      onDeny={vi.fn()}
      onAnswer={vi.fn()}
      onCopyMessage={vi.fn()}
      onRetryMessage={vi.fn()}
    />,
  );

  expect(screen.getByText("思考已完成")).toBeInTheDocument();
  expect(screen.getByText("完成")).toBeInTheDocument();
});
```

- [ ] **Step 3: Write failing tool input preview test**

Add to `src/app/components/ToolCallCard.test.tsx`.

```tsx
it("shows streamed tool input when available", () => {
  render(
    <ToolCallCard
      toolCall={{
        id: "toolu-1",
        toolName: "mcp__browser__navigate",
        label: "导航",
        status: "running",
        inputSummary: "{\"url\":\"https://example.com\"}",
        streamedInput: "{\"url\":\"https://example.com\"}",
      }}
    />,
  );

  expect(screen.getByText(/https:\/\/example\.com/)).toBeInTheDocument();
});
```

- [ ] **Step 4: Write failing default model test**

Add or update `src/app/components/ConversationPane.test.tsx`.

```tsx
it("uses Claude Sonnet 4.6 as the default composer model label", () => {
  renderConversationPane({ modelName: undefined });

  expect(screen.getByText(/Claude Sonnet 4\.6/)).toBeInTheDocument();
});
```

Use the existing test helper in that file. If no helper exists, construct `ConversationPane` with minimal required props and `state: createInitialSdkUiState()`.

- [ ] **Step 5: Run component tests and verify RED**

Run:

```bash
npm test -- src/app/components/ThinkingBlock.test.tsx src/app/components/MessageStream.test.tsx src/app/components/ToolCallCard.test.tsx src/app/components/ConversationPane.test.tsx
```

Expected: FAIL because UI still requires thinking content and default model is old.

- [ ] **Step 6: Update ThinkingBlock label**

Modify `src/app/components/ThinkingBlock.tsx`.

```tsx
const hasVisibleContent = String(children ?? "").trim().length > 0;
const label = hasVisibleContent ? "思考中…" : "思考已完成";
```

Replace header label:

```tsx
<span className="thinking-label">{label}</span>
```

Render body only when there is visible content:

```tsx
{hasVisibleContent ? (
  <div className={`thinking-body ${open ? "open" : ""}`} hidden={!open}>{children}</div>
) : null}
```

- [ ] **Step 7: Render ThinkingBlock by content or duration**

Modify `src/app/components/MessageStream.tsx`.

Replace:

```tsx
{message.thinkingContent ? (
```

with:

```tsx
{message.thinkingContent || message.thinkingDuration ? (
```

Pass safe children:

```tsx
{message.thinkingContent ?? ""}
```

- [ ] **Step 8: Show streamed input in ToolCallCard**

Modify `src/app/components/ToolCallCard.tsx`.

Use the existing input summary display location and prefer streamed input:

```tsx
const inputPreview = toolCall.streamedInput ?? toolCall.inputSummary;
```

Render `inputPreview` where `inputSummary` is currently rendered.

- [ ] **Step 9: Update default model label**

Modify `src/app/components/ConversationPane.tsx`.

```ts
modelName = "Claude Sonnet 4.6",
```

- [ ] **Step 10: Run component tests and verify GREEN**

Run:

```bash
npm test -- src/app/components/ThinkingBlock.test.tsx src/app/components/MessageStream.test.tsx src/app/components/ToolCallCard.test.tsx src/app/components/ConversationPane.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit UI changes**

Run:

```bash
git add src/app/components/ThinkingBlock.tsx src/app/components/ThinkingBlock.test.tsx src/app/components/MessageStream.tsx src/app/components/MessageStream.test.tsx src/app/components/ToolCallCard.tsx src/app/components/ToolCallCard.test.tsx src/app/components/ConversationPane.tsx src/app/components/ConversationPane.test.tsx
git commit -m "feat: 展示 thinking 耗时和工具参数流"
```

## Task 9: Add SDK Runtime Settings UI Path

**Files:**
- Modify: `src/app/components/SettingsPanel.tsx`
- Modify: `src/app/components/SettingsPanel.test.tsx`
- Modify: `src/app/backendBridge.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `electron/agent/agentSessionManager.ts`
- Modify: `electron/agent/agentSessionManager.test.ts`

- [ ] **Step 1: Write failing SettingsPanel tests**

Add to `src/app/components/SettingsPanel.test.tsx`.

```tsx
it("submits SDK permission mode and thinking settings", async () => {
  const user = userEvent.setup();
  const onApplySettings = vi.fn();

  render(<SettingsPanel open activeRunId="run-1" onApplySettings={onApplySettings} onClose={vi.fn()} />);

  await user.selectOptions(screen.getByLabelText("权限模式"), "plan");
  await user.selectOptions(screen.getByLabelText("思考强度"), "high");
  await user.selectOptions(screen.getByLabelText("Thinking 展示"), "summarized");
  await user.click(screen.getByRole("button", { name: "应用设置" }));

  expect(onApplySettings).toHaveBeenCalledWith("run-1", {
    permissionMode: "plan",
    thinking: { effort: "high", display: "summarized" },
  });
});
```

- [ ] **Step 2: Write failing App bridge test**

Add to `src/app/App.test.tsx`.

```tsx
it("sends SDK runtime settings through the backend bridge", async () => {
  const user = userEvent.setup();
  const send = vi.fn();
  vi.stubGlobal("aiTestAssistant", { send, on: vi.fn(() => () => undefined) });

  render(<App />);

  await user.click(screen.getByRole("button", { name: "SDK 控制" }));
  await user.selectOptions(screen.getByLabelText("权限模式"), "plan");
  await user.selectOptions(screen.getByLabelText("思考强度"), "high");
  await user.click(screen.getByRole("button", { name: "应用设置" }));

  expect(send).toHaveBeenCalledWith("run:apply-settings", expect.objectContaining({
    settings: expect.objectContaining({
      permissionMode: "plan",
      thinking: expect.objectContaining({ effort: "high" }),
    }),
  }));
});
```

- [ ] **Step 3: Run UI settings tests and verify RED**

Run:

```bash
npm test -- src/app/components/SettingsPanel.test.tsx src/app/App.test.tsx
```

Expected: FAIL because controls and bridge payload are not implemented.

- [ ] **Step 4: Add settings panel controls**

Modify `src/app/components/SettingsPanel.tsx`.

Add local state:

```tsx
const [permissionMode, setPermissionMode] = useState("default");
const [thinkingEffort, setThinkingEffort] = useState("medium");
const [thinkingDisplay, setThinkingDisplay] = useState("summarized");
```

Add form controls:

```tsx
<label>
  权限模式
  <select value={permissionMode} onChange={(event) => setPermissionMode(event.target.value)}>
    <option value="default">default</option>
    <option value="acceptEdits">acceptEdits</option>
    <option value="bypassPermissions">bypassPermissions</option>
    <option value="plan">plan</option>
  </select>
</label>
<label>
  思考强度
  <select value={thinkingEffort} onChange={(event) => setThinkingEffort(event.target.value)}>
    <option value="low">low</option>
    <option value="medium">medium</option>
    <option value="high">high</option>
    <option value="xhigh">xhigh</option>
    <option value="max">max</option>
  </select>
</label>
<label>
  Thinking 展示
  <select value={thinkingDisplay} onChange={(event) => setThinkingDisplay(event.target.value)}>
    <option value="summarized">summarized</option>
    <option value="omitted">omitted</option>
  </select>
</label>
```

Ensure submit calls:

```ts
onApplySettings(activeRunId, {
  permissionMode,
  thinking: { effort: thinkingEffort, display: thinkingDisplay },
});
```

- [ ] **Step 5: Ensure backend bridge sends run:apply-settings**

Modify `src/app/backendBridge.ts` so `applySettings(runId, settings)` sends:

```ts
window.aiTestAssistant.send("run:apply-settings", { runId, settings });
```

- [ ] **Step 6: Ensure App passes onApplySettings to SettingsPanel**

Modify `src/app/App.tsx` so the handler calls the backend bridge with the active run id and settings object.

- [ ] **Step 7: Forward applySettings to live SDK session**

Confirm `electron/agent/agentSessionManager.ts` keeps:

```ts
applySettings(runId: string, settings: Record<string, unknown>) {
  return this.session(runId).applyFlagSettings(settings);
}
```

Add a test in `electron/agent/agentSessionManager.test.ts` if not already present:

```ts
await manager.applySettings("run-1", { permissionMode: "plan", thinking: { effort: "high", display: "summarized" } });
expect(session.applyFlagSettings).toHaveBeenCalledWith({ permissionMode: "plan", thinking: { effort: "high", display: "summarized" } });
```

- [ ] **Step 8: Run settings tests and verify GREEN**

Run:

```bash
npm test -- src/app/components/SettingsPanel.test.tsx src/app/App.test.tsx electron/agent/agentSessionManager.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit settings path**

Run:

```bash
git add src/app/components/SettingsPanel.tsx src/app/components/SettingsPanel.test.tsx src/app/backendBridge.ts src/app/App.tsx src/app/App.test.tsx electron/agent/agentSessionManager.ts electron/agent/agentSessionManager.test.ts
git commit -m "feat: 暴露 SDK 运行设置"
```

## Task 10: Add Minimal Count Tokens and Low-Priority Capability Stubs

**Files:**
- Modify: `electron/agent/claudeAgentSdkFacade.ts`
- Modify: `electron/agent/claudeAgentRuntimeAdapter.ts`
- Modify: `electron/agent/claudeAgentRuntimeAdapter.test.ts`
- Modify: `src/ipc/channels.ts`
- Modify: `src/ipc/channels.test.ts`
- Modify: `src/ipc/payloadSchemas.ts`
- Modify: `src/ipc/payloadSchemas.test.ts`
- Modify: `src/app/backendBridge.ts`
- Modify: `src/app/components/Composer.tsx`
- Modify: `src/app/components/Composer.test.tsx`

- [ ] **Step 1: Write failing channel tests for token count**

Add to `src/ipc/channels.test.ts`:

```ts
expect(isRendererToMainChannel("sdk:count-tokens" as any)).toBe(true);
expect(isMainToRendererChannel("sdk:token-counted" as any)).toBe(true);
```

- [ ] **Step 2: Write failing payload schema tests for token count**

Add to `src/ipc/payloadSchemas.test.ts`:

```ts
it("accepts token count request and response payloads", () => {
  expect(parseRendererToMainPayload("sdk:count-tokens" as any, {
    runId: "run-1",
    prompt: "测试订单流程",
  })).toEqual({ runId: "run-1", prompt: "测试订单流程" });

  expect(parseMainToRendererPayload("sdk:token-counted" as any, {
    runId: "run-1",
    inputTokens: 128,
  })).toEqual({ runId: "run-1", inputTokens: 128 });
});
```

- [ ] **Step 3: Run token IPC tests and verify RED**

Run:

```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts
```

Expected: FAIL because token count channels do not exist.

- [ ] **Step 4: Add token count IPC channels and schemas**

Modify `src/ipc/channels.ts`:

```ts
"sdk:count-tokens",
"sdk:token-counted",
```

Modify `src/ipc/payloadSchemas.ts`:

```ts
"sdk:count-tokens": z.object({ runId: nonEmptyString, prompt: z.string() }),
"sdk:token-counted": z.object({ runId: nonEmptyString, inputTokens: z.number().int().nonnegative() }),
```

- [ ] **Step 5: Expose countTokens in the SDK facade**

Modify `electron/agent/claudeAgentSdkFacade.ts`:

```ts
export * from "@anthropic-ai/claude-agent-sdk";
```

If `countTokens` is not exported by the installed SDK version, add an adapter method that throws:

```ts
export async function countPromptTokens(): Promise<{ inputTokens: number }> {
  throw new Error("countTokens is not available in the installed Claude Agent SDK version");
}
```

Then add a follow-up test asserting the app surfaces a retryable `sdk:error`. Use the real SDK export when available.

- [ ] **Step 6: Add runtime adapter count method**

Modify `electron/agent/claudeAgentRuntimeAdapter.ts` only if the SDK query result exposes a count method. Otherwise keep token count as a facade-level function called from main IPC.

- [ ] **Step 7: Add Composer display test**

Add to `src/app/components/Composer.test.tsx`:

```tsx
it("shows counted input tokens when provided", () => {
  render(<Composer value="测试" onChange={vi.fn()} onSubmit={vi.fn()} onAddContent={vi.fn()} modelName="Claude Sonnet 4.6" usage={{ inputTokens: 128, outputTokens: 0 }} />);

  expect(screen.getByText(/128/)).toBeInTheDocument();
});
```

- [ ] **Step 8: Run token count related tests and verify GREEN**

Run:

```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts src/app/components/Composer.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit token count scaffolding**

Run:

```bash
git add electron/agent/claudeAgentSdkFacade.ts electron/agent/claudeAgentRuntimeAdapter.ts electron/agent/claudeAgentRuntimeAdapter.test.ts src/ipc/channels.ts src/ipc/channels.test.ts src/ipc/payloadSchemas.ts src/ipc/payloadSchemas.test.ts src/app/backendBridge.ts src/app/components/Composer.tsx src/app/components/Composer.test.tsx
git commit -m "feat: 增加 token 计数通道"
```

## Task 11: Full Verification and Regression Pass

**Files:**
- Verify only unless a test exposes a real regression.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
npm test -- electron/agent/runEventMapper.test.ts electron/agent/agentSessionManager.test.ts electron/agent/agentConfig.test.ts electron/agent/approvalBridge.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused IPC and frontend tests**

Run:

```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts src/app/sdkEventStore.test.ts src/app/components/ThinkingBlock.test.tsx src/app/components/MessageStream.test.tsx src/app/components/ToolCallCard.test.tsx src/app/components/ConversationPane.test.tsx src/app/components/SettingsPanel.test.tsx src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run all unit and component tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS with TypeScript, Electron preload, Electron main, and Vite build all successful.

- [ ] **Step 5: Inspect git diff**

Run:

```bash
git diff --stat
git diff --check
```

Expected: `git diff --check` reports no whitespace errors.

- [ ] **Step 6: Commit final verification note if fixes were needed**

If verification required small fixes, commit those files:

```bash
git add <fixed-files>
git commit -m "fix: 修正 SDK 适配回归"
```

If no fixes were needed, do not create an empty commit.

## Review Checklist

- [ ] P0 thinking stream mapping is covered by mapper tests and UI tests.
- [ ] P0 event coverage includes text, thinking, tool_use, server_tool_use, input_json_delta, message_start, message_delta, message_stop, system events, and result messages.
- [ ] P1 query options are accepted through a whitelist and cannot override `cwd` or `includePartialMessages`.
- [ ] P1 `thinking.display` defaults to `summarized`.
- [ ] P2 result metadata reaches `sdkEventStore`.
- [ ] P2 permission mode and effort are available through settings.
- [ ] P3 resume/fork/continue prompt pollution is absent.
- [ ] Unknown SDK events still appear in `sdk:raw-message`.
- [ ] All new behavior has RED/GREEN test evidence.

## Self-Review

- Spec coverage: every row in the audit matrix maps to at least one task.
- Unresolved-marker scan: the plan contains no unresolved markers.
- Type consistency: event names used in mapper, IPC schema, store, and tests are consistent.
- Scope: this remains a single implementation plan because all tasks share one integration boundary, `Claude Agent SDK -> IPC -> UI`.
