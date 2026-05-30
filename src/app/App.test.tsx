import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const send = vi.fn();
const invoke = vi.fn();
const listeners = new Map<string, (payload: unknown) => void>();

beforeEach(() => {
  send.mockReset();
  invoke.mockReset();
  invoke.mockImplementation((channel: string) => {
    if (channel === "run:list-sessions") {
      return Promise.resolve([
        {
          sessionId: "run-old",
          summary: "自动化生成的摘要",
          customTitle: "订单模块回归测试",
          tag: "P1",
          lastModified: 1717000000000,
        },
      ]);
    }
    if (channel === "run:get-session-messages") {
      return Promise.resolve([
        {
          type: "user",
          uuid: "user-1",
          session_id: "run-old",
          message: { role: "user", content: "历史问题" },
          parent_tool_use_id: null,
        },
        {
          type: "assistant",
          uuid: "assistant-1",
          session_id: "run-old",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "历史回复" }],
          },
          parent_tool_use_id: null,
        },
      ]);
    }
    if (channel === "settings:get") {
      return Promise.resolve({ baseUrl: "", apiKey: "", model: "" });
    }
    return Promise.resolve(undefined);
  });
  listeners.clear();
  vi.stubGlobal("window", {
    ...window,
    alert: vi.fn(),
    aiTestAssistant: {
      send,
      invoke,
      on: vi.fn((channel: string, listener: (payload: unknown) => void) => {
        listeners.set(channel, listener);
        return () => listeners.delete(channel);
      }),
    },
  });
});

function emit(channel: string, payload: unknown) {
  const listener = listeners.get(channel);
  if (!listener) throw new Error(`No listener for ${channel}`);
  act(() => {
    listener(payload);
  });
}

describe("App backend integration", () => {
  it("starts on a new conversation and every sidebar/composer control gives visible feedback", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("新对话")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "项目" }));
    expect(screen.getByRole("complementary", { name: "项目面板" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "对话" }));
    expect(screen.queryByRole("complementary", { name: "项目面板" })).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "测试人员 专业版" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "账户菜单" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "添加内容" }));
    expect(await screen.findByText("添加内容功能即将开放")).toBeInTheDocument();
  });

  it("creates a run through IPC and renders streamed SDK events", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("消息输入"), "测试订单模块功能");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(send).toHaveBeenCalledWith("run:create", { prompt: "测试订单模块功能" });

    emit("assistant:text-delta", { runId: "run-1", messageId: "msg-1", delta: "正在生成计划" });
    emit("tool:approval-required", {
      runId: "run-1",
      requestId: "approval-1",
      toolCall: { id: "approval-1", toolName: "mcp-db.query", label: "查询订单数据库", status: "waiting_approval" },
    });
    emit("question:required", {
      runId: "run-1",
      requestId: "question-1",
      questions: [{ id: "scope", label: "测试范围", options: ["冒烟", "回归"] }],
    });

    expect(await screen.findByText("正在生成计划")).toBeInTheDocument();
    expect(screen.getAllByText("查询订单数据库", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText("需要补充信息")).toBeInTheDocument();
  });

  it("keeps ordinary chat out of the test console while continuing the same conversation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("消息输入"), "你好，介绍一下你能做什么");
    await user.click(screen.getByRole("button", { name: "发送" }));
    emit("assistant:text-delta", { runId: "run-chat", messageId: "msg-chat", delta: "你好，我可以协助测试分析。" });

    expect(screen.queryByRole("complementary", { name: "测试监控台" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("消息输入"), "继续说明");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(send).toHaveBeenCalledWith("run:create", { prompt: "你好，介绍一下你能做什么" });
    expect(send).toHaveBeenCalledWith("run:send-message", { runId: "run-chat", message: "继续说明" });
  });

  it("opens the test console only after an explicit test execution request", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("消息输入"), "测试订单模块功能");
    await user.click(screen.getByRole("button", { name: "发送" }));
    emit("assistant:text-delta", { runId: "run-test", messageId: "msg-test", delta: "正在生成测试计划" });

    expect(await screen.findByRole("complementary", { name: "测试监控台" })).toBeInTheDocument();
  });

  it("uses IPC for plan revision, tool decisions, and questions", async () => {
    const user = userEvent.setup();
    render(<App />);

    emit("assistant:text-delta", { runId: "run-1", messageId: "msg-1", delta: "计划草稿" });
    emit("tool:approval-required", {
      runId: "run-1",
      requestId: "approval-1",
      toolCall: { id: "approval-1", toolName: "mcp-db.query", label: "查询订单数据库", status: "waiting_approval" },
    });
    emit("question:required", {
      runId: "run-1",
      requestId: "question-1",
      questions: [{ id: "scope", label: "测试范围", options: ["冒烟", "回归"] }],
    });

    await user.type(screen.getByLabelText("消息输入"), "增加支付异常场景");
    await user.click(screen.getByRole("button", { name: "发送" }));
    await user.click(screen.getByRole("button", { name: "允许一次" }));
    await user.selectOptions(screen.getByLabelText("测试范围"), "回归");
    await user.click(screen.getByRole("button", { name: "提交回答" }));

    expect(send).toHaveBeenCalledWith("run:send-message", { runId: "run-1", message: "增加支付异常场景" });
    expect(send).toHaveBeenCalledWith("tool:approve", expect.objectContaining({ runId: "run-1", requestId: "approval-1" }));
    expect(send).toHaveBeenCalledWith("question:answer", { runId: "run-1", requestId: "question-1", answers: { scope: "回归" } });
  });

  it("does not keep the old alert-based plan revision path", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<App />);

    emit("assistant:text-delta", { runId: "run-1", messageId: "msg-1", delta: "计划草稿" });

    await user.type(screen.getByLabelText("消息输入"), "调整计划");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith("run:send-message", expect.objectContaining({ message: "调整计划" }));
  });

  it("renders backend startup errors even when no assistant message exists yet", async () => {
    render(<App />);

    emit("sdk:error", {
      message: "AI_TEST_LLM_BASE_URL is required",
      retryable: true,
    });

    expect(await screen.findByText("AI_TEST_LLM_BASE_URL is required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认计划并执行" })).not.toBeInTheDocument();
  });

  it("loads sessions on mount and renders them in the sidebar", async () => {
    render(<App />);
    expect(await screen.findByText("订单模块回归测试")).toBeInTheDocument();
  });

  it("loads a clicked history session into the conversation area", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "订单模块回归测试" }));

    expect(await screen.findByText("历史问题")).toBeInTheDocument();
    expect(await screen.findByText("历史回复")).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "对话" })).toHaveTextContent("订单模块回归测试");
  });

  it("shows a loading banner while a clicked history session is being restored", async () => {
    const user = userEvent.setup();
    let resolveMessages: ((value: unknown) => void) | undefined;

    invoke.mockImplementation((channel: string) => {
      if (channel === "run:list-sessions") {
        return Promise.resolve([
          {
            sessionId: "run-old",
            summary: "自动化生成的摘要",
            customTitle: "订单模块回归测试",
            tag: "P1",
            lastModified: 1717000000000,
          },
        ]);
      }
      if (channel === "run:get-session-messages") {
        return new Promise((resolve) => {
          resolveMessages = resolve;
        });
      }
      if (channel === "settings:get") {
        return Promise.resolve({ baseUrl: "", apiKey: "", model: "" });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "订单模块回归测试" }));

    expect(screen.getByRole("status", { name: "正在加载历史会话" })).toBeInTheDocument();
    expect(screen.getByText("正在加载历史会话…")).toBeInTheDocument();

    await act(async () => {
      resolveMessages?.([
        {
          type: "user",
          uuid: "user-1",
          session_id: "run-old",
          message: { role: "user", content: "历史问题" },
          parent_tool_use_id: null,
        },
      ]);
    });

    expect(await screen.findByText("历史问题")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "正在加载历史会话" })).not.toBeInTheDocument();
  });
});
