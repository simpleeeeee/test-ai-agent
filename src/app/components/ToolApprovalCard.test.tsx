import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolApprovalCard } from "./ToolApprovalCard";

const request = {
  runId: "run-1",
  requestId: "approval-1",
  toolCall: {
    id: "approval-1",
    toolName: "mcp-db.query",
    label: "查询订单数据库",
    status: "waiting_approval" as const,
    approvalReason: "AI 请求查询订单数据库",
  },
};

describe("ToolApprovalCard", () => {
  it("submits allow, deny, and allow-with-changes decisions", async () => {
    const user = userEvent.setup();
    const approve = vi.fn();
    const deny = vi.fn();

    render(<ToolApprovalCard request={request} onApprove={approve} onDeny={deny} />);

    fireEvent.change(screen.getByLabelText("调整工具输入"), { target: { value: "{\"limit\":1}" } });
    await user.click(screen.getByRole("checkbox", { name: "应用权限建议" }));
    await user.click(screen.getByRole("button", { name: "允许" }));
    await user.click(screen.getByRole("button", { name: "拒绝" }));

    expect(approve).toHaveBeenCalledWith("run-1", "approval-1", {
      updatedInput: { limit: 1 },
      applyPermissionSuggestions: true,
    });
    expect(deny).toHaveBeenCalledWith("run-1", "approval-1", "用户拒绝了工具调用");
  });
});
