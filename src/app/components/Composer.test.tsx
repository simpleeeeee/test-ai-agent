import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("ignores blank input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="" onChange={vi.fn()} onSubmit={onSubmit} onAddContent={vi.fn()} placeholder="向 AI 测试助手提问…" />);

    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders high-fidelity Chinese controls and submits trimmed text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="  测试订单模块  " onChange={vi.fn()} onSubmit={onSubmit} onAddContent={vi.fn()} placeholder="补充测试指令或继续提问…" />);

    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "补充测试指令或继续提问…");
    expect(screen.queryByPlaceholderText("回复 Claude…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加内容" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "工具" })).not.toBeInTheDocument();
    expect(screen.queryByText("Claude Sonnet 4")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith("测试订单模块");
  });
});
