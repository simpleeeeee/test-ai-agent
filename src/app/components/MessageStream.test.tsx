import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageStream } from "./MessageStream";

describe("MessageStream", () => {
  it("renders Claude-style chat content without MCP status or reaction controls", () => {
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
        toolCall: { id: "approval-1", toolName: "mcp-db.query", label: "查询订单", status: "waiting_approval" },
      }],
      questions: [{ runId: "run-1", requestId: "question-1", questions: [{ id: "scope", label: "测试范围" }] }],
      mcpServers: [{ name: "browser", status: "connected" }],
      evidence: [],
      rawMessages: [{ type: "system", subtype: "compact_boundary" }],
      usage: { input_tokens: 10 },
      errors: [{ message: "网关认证失败", retryable: true }],
      tasks: [{ taskId: "task-1", summary: "正在执行子任务" }],
      sessions: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} />);

    expect(screen.getByText("帮我分析订单风险")).toBeInTheDocument();
    expect(screen.getByText("正在生成计划")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "复制回复" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "重试回复" })).toHaveLength(1);
    expect(screen.getByText("查询订单")).toBeInTheDocument();
    expect(screen.getByText("需要补充信息")).toBeInTheDocument();
    expect(screen.queryByText("browser connected")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("收藏回复")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("赞同回复")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("反对回复")).not.toBeInTheDocument();
  });
});
