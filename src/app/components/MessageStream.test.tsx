import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      notifications: [],
      taskNotifications: [],
      rateLimitInfo: undefined,
      toolProgress: new Map(),
      mirrorErrors: [],
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
      notifications: [],
      taskNotifications: [],
      rateLimitInfo: undefined,
      toolProgress: new Map(),
      mirrorErrors: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("2s")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开思考" }).querySelector("svg")).toBeTruthy();
    expect(screen.queryByText("分析用户需求…检查测试范围…")).not.toBeVisible();
  });

  it("renders assistant markdown as Claude-style message content", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: "## 核心任务\n1. **生成测试计划**\n2. 执行测试\n3. [查看文档](https://example.com)\n4. `npm test`\n\n```ts\nconst orderId = 1;\n```\n\n| 项目 | 状态 |\n| --- | --- |\n| 订单 | 已完成 |\n\n> 先确认范围",
          complete: true,
        },
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
      notifications: [],
      taskNotifications: [],
      rateLimitInfo: undefined,
      toolProgress: new Map(),
      mirrorErrors: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "核心任务", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("生成测试计划").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "查看文档" })).toHaveAttribute("href", "https://example.com");
    expect(screen.getByText("npm test").tagName).toBe("CODE");
    expect(document.querySelector("table")).toBeInTheDocument();
    expect(screen.getByText("先确认范围").closest("blockquote")).toBeInTheDocument();
    expect(screen.queryByText(/## 核心任务/)).not.toBeInTheDocument();
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
      notifications: [],
      taskNotifications: [],
      rateLimitInfo: undefined,
      toolProgress: new Map(),
      mirrorErrors: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
  });

  it("renders transcript-style tool calls in the message stream", async () => {
    const user = userEvent.setup();
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [
        { id: "msg-1", role: "assistant", content: "正在处理", complete: true },
      ],
      toolCalls: [
        {
          id: "tool-1",
          toolName: "Read",
          label: "src/domain/testRun.ts",
          status: "completed",
          inputSummary: "src/domain/testRun.ts",
          outputSummary: "export type RunStatus = ...",
        },
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
      notifications: [],
      taskNotifications: [],
      rateLimitInfo: undefined,
      toolProgress: new Map(),
      mirrorErrors: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    expect(screen.getByText("Read")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "调用过程" }));
    const detail = screen.getByRole("button", { name: "调用过程" }).nextElementSibling as HTMLElement;
    expect(detail?.textContent).toContain("调用工具：Read");
    expect(detail?.textContent).toContain("目标文件：src/domain/testRun.ts");
    expect(detail?.textContent).toContain("返回内容：export type RunStatus = ...");
  });

  it("renders write tool calls as file-change transcripts", async () => {
    const user = userEvent.setup();
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [],
      toolCalls: [
        {
          id: "tool-2",
          toolName: "Write",
          label: "tests/e2e/order-regression.spec.ts",
          status: "completed",
          inputSummary: "tests/e2e/order-regression.spec.ts",
          outputSummary: "import { test, expect } from \"@playwright/test\";",
        },
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
      notifications: [],
      taskNotifications: [],
      rateLimitInfo: undefined,
      toolProgress: new Map(),
      mirrorErrors: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "调用过程" }));
    const detail = screen.getByRole("button", { name: "调用过程" }).nextElementSibling as HTMLElement;
    expect(detail?.textContent).toContain("调用工具：Write");
    expect(detail?.textContent).toContain("目标文件：tests/e2e/order-regression.spec.ts");
    expect(detail?.textContent).toContain("写入内容：import { test, expect } from \"@playwright/test\";");
  });

  it("renders conversation entries in transcript order when available", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [],
      conversationEntries: [
        { id: "user-1", kind: "user-message", messageId: "user-1", content: "先读文件", complete: true },
        { id: "assistant-1", kind: "assistant-message", messageId: "assistant-1", content: "正在处理", complete: false, thinkingContent: "分析任务…" },
        { id: "tool-1", kind: "tool-call", toolCall: { id: "tool-1", toolName: "Read", label: "src/domain/testRun.ts", status: "completed", inputSummary: "src/domain/testRun.ts", outputSummary: "export type RunStatus = ..." } },
        { id: "approval-1", kind: "approval", request: { runId: "run-1", requestId: "approval-1", toolCall: { id: "approval-1", toolName: "Write", label: "tests/e2e/order-regression.spec.ts", status: "waiting_approval", inputSummary: "tests/e2e/order-regression.spec.ts" } } },
        { id: "question-1", kind: "question", request: { runId: "run-1", requestId: "question-1", questions: [{ id: "scope", label: "测试范围" }] } },
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
      notifications: [],
      taskNotifications: [],
      rateLimitInfo: undefined,
      toolProgress: new Map(),
      mirrorErrors: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    const column = document.querySelector(".message-column");
    expect(column).toBeInTheDocument();
    expect(Array.from(column!.children).map((child) => (child as HTMLElement).className)).toEqual([
      "message user-message",
      "message assistant-message",
      "tool-call-card",
      "approval-transcript",
      "question-transcript",
    ]);
  });

  it("renders rate-limit banner when rateLimitInfo is present", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [],
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
      notifications: [],
      taskNotifications: [],
      rateLimitInfo: { tokensRemaining: 42 },
      toolProgress: new Map(),
      mirrorErrors: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    const banner = screen.getByRole("alert");
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/剩余 token: 42/)).toBeInTheDocument();
  });

  it("renders system notifications", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [],
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
      notifications: [
        { notificationType: "warning", title: "提示", message: "已到达速率上限" },
      ],
      taskNotifications: [],
      rateLimitInfo: undefined,
      toolProgress: new Map(),
      mirrorErrors: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    expect(screen.getByText("已到达速率上限")).toBeInTheDocument();
    const notif = document.querySelector(".system-notification");
    expect(notif).toBeInTheDocument();
    expect(notif?.getAttribute("data-notification-type")).toBe("warning");
  });
});
