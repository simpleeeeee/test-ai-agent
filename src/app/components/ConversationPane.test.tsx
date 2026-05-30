import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInitialSdkUiState } from "../sdkEventStore";
import { ConversationPane } from "./ConversationPane";

const callbacks = {
  onApprove: vi.fn(),
  onDeny: vi.fn(),
  onAnswer: vi.fn(),
  onCopyMessage: vi.fn(),
  onRetryMessage: vi.fn(),
  onApprovePlan: vi.fn(),
  onComposerChange: vi.fn(),
  onComposerSubmit: vi.fn(),
  onAddContent: vi.fn(),
  onMinimizeWindow: vi.fn(),
  onToggleMaximizeWindow: vi.fn(),
  onCloseWindow: vi.fn(),
};

describe("ConversationPane", () => {
  it("renders ordinary empty chat without title menu or execution state", () => {
    render(
      <ConversationPane
        state={createInitialSdkUiState()}
        title="新对话"
        composerValue=""
        hasTestExecution={false}
        activeRunId={undefined}
        onApprove={callbacks.onApprove}
        onDeny={callbacks.onDeny}
        onAnswer={callbacks.onAnswer}
        onCopyMessage={callbacks.onCopyMessage}
        onRetryMessage={callbacks.onRetryMessage}
        onApprovePlan={callbacks.onApprovePlan}
        onComposerChange={callbacks.onComposerChange}
        onComposerSubmit={callbacks.onComposerSubmit}
        onAddContent={callbacks.onAddContent}
        onMinimizeWindow={callbacks.onMinimizeWindow}
        onToggleMaximizeWindow={callbacks.onToggleMaximizeWindow}
        onCloseWindow={callbacks.onCloseWindow}
      />,
    );

    expect(screen.getByRole("main", { name: "对话" })).toBeInTheDocument();
    expect(screen.getByText("新对话")).toBeInTheDocument();
    expect(screen.queryByLabelText("会话菜单")).not.toBeInTheDocument();
    expect(screen.queryByText("普通聊天")).not.toBeInTheDocument();
    expect(screen.queryByText("未进入测试执行")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "今天想测试什么？" })).toBeInTheDocument();
    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "向 AI 测试助手提问…");
    expect(screen.getByRole("button", { name: "最小化窗口" })).toBeInTheDocument();
  });

  it("renders test mode composer copy and confirm button", async () => {
    const user = userEvent.setup();
    const state = createInitialSdkUiState();
    state.activeRunId = "run-1";
    state.messages = [{ id: "msg-1", role: "assistant", content: "计划草稿", complete: true }];

    render(
      <ConversationPane
        state={state}
        title="订单模块回归"
        composerValue=""
        hasTestExecution={true}
        activeRunId="run-1"
        onApprove={callbacks.onApprove}
        onDeny={callbacks.onDeny}
        onAnswer={callbacks.onAnswer}
        onCopyMessage={callbacks.onCopyMessage}
        onRetryMessage={callbacks.onRetryMessage}
        onApprovePlan={callbacks.onApprovePlan}
        onComposerChange={callbacks.onComposerChange}
        onComposerSubmit={callbacks.onComposerSubmit}
        onAddContent={callbacks.onAddContent}
        onMinimizeWindow={callbacks.onMinimizeWindow}
        onToggleMaximizeWindow={callbacks.onToggleMaximizeWindow}
        onCloseWindow={callbacks.onCloseWindow}
      />,
    );

    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "补充测试指令或继续提问…");
    await user.click(screen.getByRole("button", { name: "确认计划并执行" }));
    expect(callbacks.onApprovePlan).toHaveBeenCalledTimes(1);
  });

  it("shows a loading banner while a history session is being restored", () => {
    render(
      <ConversationPane
        state={createInitialSdkUiState()}
        title="订单模块回归"
        composerValue=""
        hasTestExecution={false}
        activeRunId="run-1"
        loadingHistorySession
        onApprove={callbacks.onApprove}
        onDeny={callbacks.onDeny}
        onAnswer={callbacks.onAnswer}
        onCopyMessage={callbacks.onCopyMessage}
        onRetryMessage={callbacks.onRetryMessage}
        onApprovePlan={callbacks.onApprovePlan}
        onComposerChange={callbacks.onComposerChange}
        onComposerSubmit={callbacks.onComposerSubmit}
        onAddContent={callbacks.onAddContent}
        onMinimizeWindow={callbacks.onMinimizeWindow}
        onToggleMaximizeWindow={callbacks.onToggleMaximizeWindow}
        onCloseWindow={callbacks.onCloseWindow}
      />,
    );

    expect(screen.getByRole("status", { name: "正在加载历史会话" })).toBeInTheDocument();
    expect(screen.getByText("正在加载历史会话…")).toBeInTheDocument();
  });
});
