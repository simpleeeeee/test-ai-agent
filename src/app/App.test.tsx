import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const send = vi.fn();
const invoke = vi.fn();
const listeners = new Map<string, (payload: unknown) => void>();

beforeEach(() => {
  send.mockReset();
  invoke.mockReset();
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
  listener(payload);
}

describe("App backend integration", () => {
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

  it("uses IPC for plan revision, tool decisions, questions, and SDK controls", async () => {
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
    await user.click(screen.getByRole("button", { name: "SDK 控制" }));
    await user.type(screen.getByLabelText("模型"), "gateway-model");
    await user.click(screen.getByRole("button", { name: "应用模型" }));

    expect(send).toHaveBeenCalledWith("run:send-message", { runId: "run-1", message: "增加支付异常场景" });
    expect(send).toHaveBeenCalledWith("tool:approve", expect.objectContaining({ runId: "run-1", requestId: "approval-1" }));
    expect(send).toHaveBeenCalledWith("question:answer", { runId: "run-1", requestId: "question-1", answers: { scope: "回归" } });
    expect(invoke).toHaveBeenCalledWith("run:set-model", { runId: "run-1", model: "gateway-model" });
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
});
