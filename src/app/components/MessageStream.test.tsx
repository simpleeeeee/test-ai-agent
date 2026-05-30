import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageStream } from "./MessageStream";

describe("MessageStream", () => {
  it("renders messages in one narrow column without SDK debug details or reaction controls", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [
        { id: "msg-user", role: "user", content: "帮我分析订单风险", complete: true },
        { id: "msg-1", role: "assistant", content: "正在生成计划", complete: false },
      ],
      approvals: [{
        runId: "run-1",
        requestId: "approval-1",
        toolCall: {
          id: "approval-1",
          toolName: "browser.navigate",
          label: "浏览器工具",
          status: "waiting_approval",
          inputSummary: "目标：/orders",
          approvalReason: "打开订单列表页。",
        },
      }],
      questions: [{ runId: "run-1", requestId: "question-1", questions: [{ id: "scope", label: "测试范围" }] }],
      mcpServers: [{ name: "browser", status: "connected" }],
      evidence: [],
      rawMessages: [{ type: "system", subtype: "compact_boundary" }],
      usage: { inputTokens: 10, outputTokens: 20 },
      errors: [{ message: "网关认证失败", retryable: true }],
      tasks: [{ taskId: "task-1", summary: "正在执行子任务" }],
      sessions: [],
      permissionDenials: [],
      systemEvents: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    const column = document.querySelector(".message-column");
    expect(column).toBeInTheDocument();

    const userMessage = screen.getByText("帮我分析订单风险").closest(".user-bubble");
    expect(userMessage).toBeInTheDocument();

    expect(screen.getByText("正在生成计划")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "复制回复" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "重试回复" })).toHaveLength(1);
    expect(screen.getByText("ai-assistant request browser.navigate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "允许一次" })).toBeInTheDocument();
    expect(screen.getByText("需要补充信息")).toBeInTheDocument();
    expect(screen.queryByText("SDK Usage")).not.toBeInTheDocument();
    expect(screen.queryByText(/SDK Raw Message/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("收藏回复")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("赞同回复")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("反对回复")).not.toBeInTheDocument();
  });

  it("renders thinking blocks for assistant messages that have thinking content", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [
        { id: "msg-1", role: "assistant", content: "计划已生成", complete: true, thinkingContent: "分析用户需求…检查测试范围…", thinkingDuration: "2s" },
      ],
      approvals: [],
      questions: [],
      mcpServers: [],
      evidence: [],
      rawMessages: [],
      usage: { inputTokens: 10, outputTokens: 20 },
      errors: [],
      tasks: [],
      sessions: [],
      permissionDenials: [],
      systemEvents: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    expect(screen.getByText("思考中…")).toBeInTheDocument();
    expect(screen.getByText("2s")).toBeInTheDocument();
    expect(screen.getByText("分析用户需求…检查测试范围…")).toBeInTheDocument();
  });

  it("renders a thinking block when only thinking duration is present", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [
        { id: "msg-1", role: "assistant", content: "完成", complete: true, thinkingDuration: "1.45s" },
      ],
      approvals: [],
      questions: [],
      mcpServers: [],
      evidence: [],
      rawMessages: [],
      usage: { inputTokens: 10, outputTokens: 20 },
      errors: [],
      tasks: [],
      sessions: [],
      permissionDenials: [],
      systemEvents: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    expect(screen.getByText("思考已完成")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
  });
});
