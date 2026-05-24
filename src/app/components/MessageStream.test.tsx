import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageStream } from "./MessageStream";

describe("MessageStream", () => {
  it("renders streamed messages, approvals, questions, raw audit rows, and status records", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      messages: [{ id: "msg-1", role: "assistant", content: "正在生成计划", complete: false }],
      approvals: [{
        runId: "run-1",
        requestId: "approval-1",
        toolCall: { id: "approval-1", toolName: "mcp-db.query", label: "查询订单", status: "waiting_approval" },
      }],
      questions: [{ runId: "run-1", requestId: "question-1", questions: [{ id: "scope", label: "测试范围" }] }],
      mcpServers: [{ name: "browser", status: "connected" }],
      rawMessages: [{ type: "system", subtype: "compact_boundary" }],
      usage: { input_tokens: 10 },
      errors: [{ message: "网关认证失败", retryable: true }],
      tasks: [{ taskId: "task-1", summary: "正在执行子任务" }],
      sessions: [],
      workspaceModes: {},
      evidence: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} />);

    expect(screen.getByText("正在生成计划")).toBeInTheDocument();
    expect(screen.getByText("查询订单")).toBeInTheDocument();
    expect(screen.getByText("需要补充信息")).toBeInTheDocument();
    expect(screen.getByText("browser connected")).toBeInTheDocument();
    expect(screen.getByText("网关认证失败")).toBeInTheDocument();
    expect(screen.getByText("正在执行子任务")).toBeInTheDocument();
    expect(screen.getByText("SDK Raw Message 1")).toBeInTheDocument();
  });
});
