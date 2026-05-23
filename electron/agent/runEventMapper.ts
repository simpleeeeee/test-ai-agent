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

export function mapSdkMessageToRunEvents(runId: string, message: any): RunEvent[] {
  const events: RunEvent[] = [];

  if (message.type === "stream_event") {
    const sdkEvent = message.event;
    if (sdkEvent?.type === "content_block_delta" && sdkEvent.delta?.type === "text_delta") {
      events.push({
        type: "assistant:text-delta",
        messageId: message.uuid,
        delta: sdkEvent.delta.text,
      });
    }
    if (sdkEvent?.type === "content_block_start" && sdkEvent.content_block?.type === "tool_use") {
      const tool = sdkEvent.content_block;
      events.push({
        type: "tool:call-started",
        toolCall: {
          id: tool.id,
          toolName: tool.name,
          label: `调用 ${tool.name}`,
          status: "running",
          inputSummary: summarize(tool.input ?? {}),
        },
      });
    }
  }

  if (message.type === "result") {
    if (typeof message.session_id === "string") {
      events.push({ type: "sdk:session-changed", sessionId: message.session_id });
    }
    if (message.usage) {
      events.push({ type: "sdk:usage", raw: message.usage });
    }
    events.push({
      type: "run:status-changed",
      status: message.subtype === "success" ? "completed" : "failed",
    });
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

  events.push(raw(runId, message));
  return events;
}
