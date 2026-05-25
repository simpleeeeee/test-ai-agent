import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolApprovalCard } from "./ToolApprovalCard";

const request = {
  runId: "run-1",
  requestId: "approval-1",
  toolCall: {
    id: "approval-1",
    toolName: "browser.navigate",
    label: "浏览器工具",
    status: "waiting_approval" as const,
    inputSummary: "目标：/orders?status=pending_payment\n操作：读取页面状态，不修改业务数据",
    approvalReason: `打开订单列表页，并检查"待支付"状态筛选是否正确。`,
  },
};

describe("ToolApprovalCard", () => {
  it("renders Claude Code style review content and toggles details", async () => {
    const user = userEvent.setup();

    render(<ToolApprovalCard request={request} onApprove={vi.fn()} onDeny={vi.fn()} />);

    expect(screen.getByRole("region", { name: "需要审核工具调用" })).toBeInTheDocument();
    expect(screen.getByText("AI 测试助手想使用浏览器工具")).toBeInTheDocument();
    expect(screen.getByText("需要你审核后才能继续执行")).toBeInTheDocument();
    expect(screen.getByText("等待审核")).toBeInTheDocument();
    expect(screen.getByText(`打开订单列表页，并检查"待支付"状态筛选是否正确。`)).toBeInTheDocument();
    expect(screen.getByText(/工具：browser.navigate/)).toBeInTheDocument();
    expect(screen.getByText("影响范围：会访问当前测试环境页面，并把结果写入本次会话证据。")).toBeInTheDocument();

    expect(screen.queryByLabelText("原始工具输入")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看详情" }));
    expect(screen.getByLabelText("原始工具输入")).toHaveTextContent("browser.navigate");
    await user.click(screen.getByRole("button", { name: "收起详情" }));
    expect(screen.queryByLabelText("原始工具输入")).not.toBeInTheDocument();
  });

  it("submits allow once, allow for session, and deny decisions", async () => {
    const user = userEvent.setup();
    const approve = vi.fn();
    const deny = vi.fn();

    render(<ToolApprovalCard request={request} onApprove={approve} onDeny={deny} />);

    await user.click(screen.getByRole("button", { name: "允许一次" }));
    expect(approve).toHaveBeenCalledWith("run-1", "approval-1", {
      updatedInput: undefined,
      applyPermissionSuggestions: false,
    });
    expect(screen.getByText("已允许一次")).toBeInTheDocument();

    cleanup();
    render(<ToolApprovalCard request={request} onApprove={approve} onDeny={deny} />);
    await user.click(screen.getByRole("button", { name: "本会话允许" }));
    expect(approve).toHaveBeenCalledWith("run-1", "approval-1", {
      updatedInput: undefined,
      applyPermissionSuggestions: true,
    });

    cleanup();
    render(<ToolApprovalCard request={request} onApprove={approve} onDeny={deny} />);
    fireEvent.change(screen.getByLabelText("拒绝原因"), { target: { value: "当前环境不允许访问订单页面" } });
    await user.click(screen.getByRole("button", { name: "拒绝" }));
    expect(deny).toHaveBeenCalledWith("run-1", "approval-1", "当前环境不允许访问订单页面");
  });
});
