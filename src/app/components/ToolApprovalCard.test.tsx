import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolApprovalCard } from "./ToolApprovalCard";

const request = {
  runId: "run-1",
  requestId: "approval-1",
  toolCall: {
    id: "approval-1",
    toolName: "browser.navigate",
    label: "浏览器导航",
    status: "waiting_approval" as const,
    inputSummary: "目标：/orders?status=pending_payment\n操作：读取页面状态，不修改业务数据",
    approvalReason: "打开订单列表页，并检查待支付状态筛选是否正确。",
  },
};

describe("ToolApprovalCard", () => {
  it("renders terminal-style approval with tool name and buttons", () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(<ToolApprovalCard request={request} onApprove={onApprove} onDeny={onDeny} />);

    expect(screen.getAllByText(/browser.navigate/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "允许一次" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "本会话允许" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeInTheDocument();
  });

  it("highlights allow-once and disables other buttons on click", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(<ToolApprovalCard request={request} onApprove={onApprove} onDeny={onDeny} />);

    await user.click(screen.getByRole("button", { name: "允许一次" }));
    expect(onApprove).toHaveBeenCalledWith("run-1", "approval-1", { updatedInput: undefined, applyPermissionSuggestions: false });

    const allowOnceBtn = screen.getByRole("button", { name: "允许一次" });
    expect(allowOnceBtn).not.toBeDisabled();
    expect(allowOnceBtn).toHaveClass("is-selected");

    expect(screen.getByRole("button", { name: "本会话允许" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeDisabled();
  });

  it("highlights allow-session and disables others", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(<ToolApprovalCard request={request} onApprove={onApprove} onDeny={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "本会话允许" }));
    expect(onApprove).toHaveBeenCalledWith("run-1", "approval-1", { updatedInput: undefined, applyPermissionSuggestions: true });

    expect(screen.getByRole("button", { name: "本会话允许" })).toHaveClass("is-selected");
    expect(screen.getByRole("button", { name: "允许一次" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeDisabled();
  });

  it("highlights deny and disables others", async () => {
    const user = userEvent.setup();
    const onDeny = vi.fn();
    render(<ToolApprovalCard request={request} onApprove={vi.fn()} onDeny={onDeny} />);

    await user.click(screen.getByRole("button", { name: "拒绝" }));
    expect(onDeny).toHaveBeenCalledWith("run-1", "approval-1", "用户拒绝了此次工具调用");

    expect(screen.getByRole("button", { name: "拒绝" })).toHaveClass("is-selected");
    expect(screen.getByRole("button", { name: "允许一次" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "本会话允许" })).toBeDisabled();
  });
});
