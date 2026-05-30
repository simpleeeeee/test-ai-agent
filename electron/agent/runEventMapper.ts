import type { RunEvent } from "../../src/domain/testRun.js";

function summarize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function raw(runId: string, message: unknown): RunEvent {
  return { type: "sdk:raw-message", runId, message };
}

type BlockState = {
  type: string;
  toolCallId?: string;
  thinkingStartedAt?: number;
};

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

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

export function mapPermissionRequestToRunEvent(
  requestId: string,
  toolName: string,
  input: Record<string, unknown>,
  reason: string,
): RunEvent {
  return {
    type: "tool:approval-required",
    toolCall: {
      id: requestId,
      toolName,
      label: `调用 ${toolName}`,
      status: "waiting_approval",
      inputSummary: summarize(input),
      approvalReason: reason,
    },
  };
}

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

  // Handle non-stream messages (result, system, etc.) via the existing logic
  events.push(...mapNonStreamSdkMessage(runId, message));
  events.push(raw(runId, message));
  return events;
}

function mapNonStreamSdkMessage(runId: string, message: any): RunEvent[] {
  const events: RunEvent[] = [];

  if (message.type === "result") {
    if (typeof message.session_id === "string") {
      events.push({ type: "sdk:session-changed", sessionId: message.session_id });
    }
    if (message.usage) {
      events.push({ type: "sdk:usage", raw: message.usage });
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
      events.push({
        type: "run:status-changed",
        status: message.subtype === "success" ? "completed" : "failed",
      });
    }
  }

  if (message.type === "system" && message.subtype === "task_progress") {
    events.push({
      type: "sdk:task-progress",
      taskId: message.task_id,
      summary: message.summary,
      raw: message,
    });
  }

  if (message.type === "system" && message.subtype === "mcp_server_status") {
    events.push({
      type: "sdk:mcp-status",
      servers: Array.isArray(message.mcp_servers) ? message.mcp_servers : [],
    });
  }

  return events;
}

export function mapSdkMessageToRunEvents(runId: string, message: any, assistantMessageId?: string): RunEvent[] {
  const session = new SdkRunEventMapperSession(runId);
  session.setAssistantMessageId(assistantMessageId);
  return session.map(message);
}
