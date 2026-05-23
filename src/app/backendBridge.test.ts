import { describe, expect, it, vi } from "vitest";
import { createBackendBridge } from "./backendBridge";

describe("backendBridge", () => {
  it("creates runs, sends messages, and stops through typed IPC", () => {
    const api = { send: vi.fn(), invoke: vi.fn(), on: vi.fn() };
    const bridge = createBackendBridge(api);

    bridge.createRun("测试订单模块功能");
    bridge.sendMessage("run-1", "继续执行");
    bridge.stopRun("run-1");

    expect(api.send).toHaveBeenCalledWith("run:create", { prompt: "测试订单模块功能" });
    expect(api.send).toHaveBeenCalledWith("run:send-message", { runId: "run-1", message: "继续执行" });
    expect(api.send).toHaveBeenCalledWith("run:stop", { runId: "run-1" });
  });

  it("approves tools with updated input and permission suggestions", () => {
    const api = { send: vi.fn(), invoke: vi.fn(), on: vi.fn() };
    const bridge = createBackendBridge(api);

    bridge.approveTool("run-1", "approval-1", {
      updatedInput: { query: "select * from orders limit 1" },
      applyPermissionSuggestions: true,
    });
    bridge.denyTool("run-1", "approval-2", "查询范围过大");

    expect(api.send).toHaveBeenCalledWith("tool:approve", {
      runId: "run-1",
      requestId: "approval-1",
      updatedInput: { query: "select * from orders limit 1" },
      applyPermissionSuggestions: true,
    });
    expect(api.send).toHaveBeenCalledWith("tool:deny", {
      runId: "run-1",
      requestId: "approval-2",
      message: "查询范围过大",
    });
  });

  it("invokes SDK controls and session operations", async () => {
    const api = { send: vi.fn(), invoke: vi.fn().mockResolvedValue(["ok"]), on: vi.fn() };
    const bridge = createBackendBridge(api);

    await bridge.setModel("run-1", "gateway-model");
    await bridge.setPermissionMode("run-1", "plan");
    await bridge.applySettings("run-1", { maxTurns: 5 });
    await bridge.mcpStatus("run-1");
    await bridge.reconnectMcpServer("run-1", "browser");
    await bridge.toggleMcpServer("run-1", "browser", false);
    await bridge.supportedModels("run-1");
    await bridge.supportedCommands("run-1");
    await bridge.supportedAgents("run-1");
    await bridge.accountInfo("run-1");
    await bridge.initializationResult("run-1");
    await bridge.stopTask("run-1", "task-1");
    await bridge.listSessions();
    await bridge.getSession("session-1");
    await bridge.resumeSession("run-1", "session-1");
    await bridge.forkSession("run-1", "session-1");
    await bridge.continueRun("run-1");
    await bridge.renameSession("session-1", "订单回归");
    await bridge.tagSession("session-1", "P1");
    await bridge.deleteSession("session-1");

    expect(api.invoke).toHaveBeenCalledWith("run:set-model", { runId: "run-1", model: "gateway-model" });
    expect(api.invoke).toHaveBeenCalledWith("run:set-permission-mode", { runId: "run-1", permissionMode: "plan" });
    expect(api.invoke).toHaveBeenCalledWith("mcp:reconnect", { runId: "run-1", serverName: "browser" });
    expect(api.invoke).toHaveBeenCalledWith("task:stop", { runId: "run-1", taskId: "task-1" });
    expect(api.invoke).toHaveBeenCalledWith("run:list-sessions", undefined);
    expect(api.invoke).toHaveBeenCalledWith("run:resume", { runId: "run-1", sessionId: "session-1" });
  });

  it("subscribes to every main-to-renderer stream and returns a cleanup function", () => {
    const cleanup = vi.fn();
    const api = { send: vi.fn(), invoke: vi.fn(), on: vi.fn(() => cleanup) };
    const bridge = createBackendBridge(api);
    const listener = vi.fn();

    const unsubscribe = bridge.subscribe(listener);
    unsubscribe();

    expect(api.on).toHaveBeenCalledWith("assistant:text-delta", expect.any(Function));
    expect(api.on).toHaveBeenCalledWith("tool:approval-required", expect.any(Function));
    expect(api.on).toHaveBeenCalledWith("question:required", expect.any(Function));
    expect(api.on).toHaveBeenCalledWith("sdk:mcp-status", expect.any(Function));
    expect(cleanup).toHaveBeenCalled();
  });
});
