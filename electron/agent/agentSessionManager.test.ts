import { describe, expect, it, vi } from "vitest";
import { AgentSessionManager } from "./agentSessionManager.js";

describe("AgentSessionManager", () => {
  it("starts a run and emits mapped events from SDK messages", async () => {
    async function* messages() {
      yield {
        type: "stream_event",
        uuid: "msg-1",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "计划" } },
      };
      yield { type: "result", subtype: "success", session_id: "session-1", usage: { input_tokens: 1 } };
    }
    const adapter = { start: vi.fn(() => ({ messages: messages(), close: vi.fn() })) };
    const emit = vi.fn();
    const manager = new AgentSessionManager({
      adapter: adapter as any,
      loadConfig: () => ({ sdkOptions: { cwd: "D:/repo" } }),
      emit,
    });

    await manager.startRun("run-1", "测试订单模块功能");

    expect(adapter.start).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.any(Object),
      options: { cwd: "D:/repo" },
      canUseTool: expect.any(Function),
    }));
    expect(emit).toHaveBeenCalledWith("assistant:text-delta", expect.objectContaining({
      runId: "run-1",
      messageId: "msg-1",
      delta: "计划",
    }));
    expect(emit).toHaveBeenCalledWith("sdk:session-changed", expect.objectContaining({
      runId: "run-1",
      sessionId: "session-1",
    }));
  });

  it("loads SDK settings from the configured app directory instead of process cwd", async () => {
    async function* messages() {
      yield { type: "result", subtype: "success", session_id: "session-1" };
    }
    const loadConfig = vi.fn(() => ({ sdkOptions: { cwd: "D:/app" } }));
    const manager = new AgentSessionManager({
      adapter: { start: vi.fn(() => ({ messages: messages(), close: vi.fn() })) } as any,
      loadConfig,
      emit: vi.fn(),
      cwd: "D:/app",
    });

    await manager.startRun("run-1", "测试订单模块功能");

    expect(loadConfig).toHaveBeenCalledWith({ cwd: "D:/app" });
  });

  it("streams approved plan continuation into the active SDK session", async () => {
    async function* messages() {
      yield { type: "result", subtype: "success", session_id: "session-1" };
    }
    const streamInput = vi.fn();
    const adapter = { start: vi.fn(() => ({ messages: messages(), streamInput, close: vi.fn() })) };
    const manager = new AgentSessionManager({
      adapter: adapter as any,
      loadConfig: () => ({ sdkOptions: {} }),
      emit: vi.fn(),
    });

    await manager.startRun("run-1", "测试订单模块功能");
    manager.approvePlan("run-1");

    expect(streamInput).toHaveBeenCalledWith({
      type: "user",
      message: { role: "user", content: "用户已确认计划，开始执行。" },
    });
  });

  it("uses stable message.id from message_start for all deltas in the same turn", async () => {
    async function* messages() {
      yield {
        type: "stream_event",
        uuid: "uuid-1",
        event: { type: "message_start", message: { id: "msg_stable_abc" } },
      };
      yield {
        type: "stream_event",
        uuid: "uuid-2",
        event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "你" } },
      };
      yield {
        type: "stream_event",
        uuid: "uuid-3",
        event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "好" } },
      };
      yield {
        type: "stream_event",
        uuid: "uuid-4",
        event: { type: "message_stop" },
      };
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

    expect(emit).toHaveBeenCalledWith("assistant:text-delta", expect.objectContaining({
      runId: "run-1",
      messageId: "msg_stable_abc",
      delta: "你",
    }));
    expect(emit).toHaveBeenCalledWith("assistant:text-delta", expect.objectContaining({
      runId: "run-1",
      messageId: "msg_stable_abc",
      delta: "好",
    }));
    expect(emit).toHaveBeenCalledWith("assistant:message-completed", expect.objectContaining({
      runId: "run-1",
      messageId: "msg_stable_abc",
    }));
  });

  it("forwards model, permission, MCP, task, and support query controls", async () => {
    async function* messages() {
      yield { type: "result", subtype: "success" };
    }
    const session = {
      messages: messages(),
      close: vi.fn(),
      setModel: vi.fn().mockResolvedValue(undefined),
      setPermissionMode: vi.fn().mockResolvedValue(undefined),
      applyFlagSettings: vi.fn().mockResolvedValue(undefined),
      mcpServerStatus: vi.fn().mockResolvedValue([]),
      setMcpServers: vi.fn().mockResolvedValue({ added: [], removed: [], errors: {} }),
      reconnectMcpServer: vi.fn().mockResolvedValue(undefined),
      toggleMcpServer: vi.fn().mockResolvedValue(undefined),
      supportedCommands: vi.fn().mockResolvedValue([]),
      supportedModels: vi.fn().mockResolvedValue([]),
      supportedAgents: vi.fn().mockResolvedValue([]),
      accountInfo: vi.fn().mockResolvedValue({}),
      initializationResult: vi.fn().mockResolvedValue({}),
      streamInput: vi.fn(),
      stopTask: vi.fn().mockResolvedValue(undefined),
    };
    const manager = new AgentSessionManager({
      adapter: { start: vi.fn(() => session) } as any,
      loadConfig: () => ({ sdkOptions: {} }),
      emit: vi.fn(),
    });

    await manager.startRun("run-1", "测试订单模块功能");

    await manager.setModel("run-1", "model-a");
    await manager.setPermissionMode("run-1", "default");
    await manager.applySettings("run-1", { permissions: {} });
    await manager.mcpStatus("run-1");
    await manager.setMcpServers("run-1", {});
    await manager.reconnectMcpServer("run-1", "db");
    await manager.toggleMcpServer("run-1", "db", true);
    await manager.supportedCommands("run-1");
    await manager.supportedModels("run-1");
    await manager.supportedAgents("run-1");
    await manager.accountInfo("run-1");
    await manager.initializationResult("run-1");
    await manager.stopTask("run-1", "task-1");
    manager.stopRun("run-1");

    expect(session.setModel).toHaveBeenCalledWith("model-a");
    expect(session.stopTask).toHaveBeenCalledWith("task-1");
    expect(session.close).toHaveBeenCalledOnce();
  });
});
