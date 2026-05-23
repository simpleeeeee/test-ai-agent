import { describe, expect, it, vi } from "vitest";
import { ClaudeAgentRuntimeAdapter } from "./claudeAgentRuntimeAdapter.js";

describe("ClaudeAgentRuntimeAdapter", () => {
  it("starts query with prompt, options, env, and canUseTool", async () => {
    async function* stream() {
      yield { type: "result", subtype: "success", session_id: "session-1" };
    }
    const queryResult = Object.assign(stream(), {
      close: vi.fn(),
      setModel: vi.fn(),
      setPermissionMode: vi.fn(),
      applyFlagSettings: vi.fn(),
      mcpServerStatus: vi.fn(),
      setMcpServers: vi.fn(),
      reconnectMcpServer: vi.fn(),
      toggleMcpServer: vi.fn(),
      supportedCommands: vi.fn(),
      supportedModels: vi.fn(),
      supportedAgents: vi.fn(),
      accountInfo: vi.fn(),
      initializationResult: vi.fn(),
      streamInput: vi.fn(),
      stopTask: vi.fn(),
    });
    const query = vi.fn(() => queryResult);
    const canUseTool = vi.fn();
    const adapter = new ClaudeAgentRuntimeAdapter({ query });

    const session = adapter.start({
      prompt: "测试订单模块功能",
      options: {
        cwd: "D:/repo",
        env: { ANTHROPIC_BASE_URL: "https://gateway.example.com", ANTHROPIC_AUTH_TOKEN: "token" },
        includePartialMessages: true,
      },
      canUseTool,
    });

    const messages = [];
    for await (const message of session.messages) {
      messages.push(message);
    }

    expect(query).toHaveBeenCalledWith({
      prompt: "测试订单模块功能",
      options: expect.objectContaining({
        cwd: "D:/repo",
        env: expect.objectContaining({ ANTHROPIC_BASE_URL: "https://gateway.example.com" }),
        includePartialMessages: true,
        canUseTool,
      }),
    });
    expect(messages).toEqual([{ type: "result", subtype: "success", session_id: "session-1" }]);
  });

  it("forwards Query control methods without reimplementing SDK behavior", async () => {
    async function* stream() {
      yield { type: "result", subtype: "success" };
    }
    const queryResult = Object.assign(stream(), {
      close: vi.fn(),
      setModel: vi.fn().mockResolvedValue(undefined),
      setPermissionMode: vi.fn().mockResolvedValue(undefined),
      applyFlagSettings: vi.fn().mockResolvedValue(undefined),
      mcpServerStatus: vi.fn().mockResolvedValue([{ name: "db", status: "connected" }]),
      setMcpServers: vi.fn().mockResolvedValue({ added: ["db"], removed: [], errors: {} }),
      reconnectMcpServer: vi.fn().mockResolvedValue(undefined),
      toggleMcpServer: vi.fn().mockResolvedValue(undefined),
      supportedCommands: vi.fn().mockResolvedValue(["/help"]),
      supportedModels: vi.fn().mockResolvedValue(["model-a"]),
      supportedAgents: vi.fn().mockResolvedValue(["general-purpose"]),
      accountInfo: vi.fn().mockResolvedValue({ account: "test" }),
      initializationResult: vi.fn().mockResolvedValue({ session_id: "session-1" }),
      streamInput: vi.fn(),
      stopTask: vi.fn().mockResolvedValue(undefined),
    });
    const adapter = new ClaudeAgentRuntimeAdapter({ query: vi.fn(() => queryResult) });
    const session = adapter.start({ prompt: "测试", options: {}, canUseTool: vi.fn() });

    await session.setModel("model-a");
    await session.setPermissionMode("default");
    await session.applyFlagSettings({ permissions: {} });
    await expect(session.mcpServerStatus()).resolves.toEqual([{ name: "db", status: "connected" }]);
    await session.setMcpServers({ db: { type: "http", url: "https://mcp.example.com" } });
    await session.reconnectMcpServer("db");
    await session.toggleMcpServer("db", true);
    await expect(session.supportedCommands()).resolves.toEqual(["/help"]);
    await expect(session.supportedModels()).resolves.toEqual(["model-a"]);
    await expect(session.supportedAgents()).resolves.toEqual(["general-purpose"]);
    await expect(session.accountInfo()).resolves.toEqual({ account: "test" });
    await expect(session.initializationResult()).resolves.toEqual({ session_id: "session-1" });
    session.streamInput({ type: "user", message: { role: "user", content: "继续" } });
    await session.stopTask("task-1");
    session.close();

    expect(queryResult.close).toHaveBeenCalledOnce();
    expect(queryResult.streamInput).toHaveBeenCalledWith({ type: "user", message: { role: "user", content: "继续" } });
  });
});
