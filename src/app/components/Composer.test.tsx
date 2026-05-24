import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("submits trimmed Chinese input and ignores blank input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="" onChange={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders Claude-style controls with accessible Chinese labels", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(<Composer value="  测试订单模块  " onChange={onChange} onSubmit={onSubmit} />);

    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "回复 Claude...");
    expect(screen.getByRole("button", { name: "添加内容" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
    expect(screen.getByText("Claude Sonnet 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(onSubmit).toHaveBeenCalledWith("测试订单模块");
  });
});
