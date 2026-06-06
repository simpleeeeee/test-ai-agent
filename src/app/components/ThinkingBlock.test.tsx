import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThinkingBlock } from "./ThinkingBlock";

describe("ThinkingBlock", () => {
  it("renders collapsed by default with thinking indicator", () => {
    render(<ThinkingBlock duration="1.2s"><p>推理内容</p></ThinkingBlock>);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开思考" }).querySelector("svg")).toBeTruthy();
    expect(screen.queryByText("推理内容")).not.toBeVisible();
  });

  it("expands and shows content on click", async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock duration="0.8s"><p>选择 B 方案</p></ThinkingBlock>);
    await user.click(screen.getByRole("button", { name: "展开思考" }));
    expect(screen.getByText("选择 B 方案")).toBeVisible();
    expect(screen.getByRole("button", { name: "收起思考" }).querySelector("svg")).toBeTruthy();
  });

  it("shows completed thinking copy when duration exists without content", () => {
    render(<ThinkingBlock duration="1.45s"> </ThinkingBlock>);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("1.45s")).toBeInTheDocument();
  });

  it("renders completed thinking as a static green state", () => {
    render(
      <ThinkingBlock duration="1.45s" complete>
        <p>已完成推理</p>
      </ThinkingBlock>,
    );

    const block = screen.getByText("Thinking").closest(".thinking-block");
    expect(block).toHaveClass("is-complete");
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("1.45s")).toBeInTheDocument();
    expect(screen.getByText("已完成推理")).not.toBeVisible();
    expect(block?.querySelector(".activity-indicator")).toHaveClass("done");
  });

  it("collapses on second click", async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock duration="1s"><p>test</p></ThinkingBlock>);
    const toggle = screen.getByRole("button", { name: "展开思考" });
    await user.click(toggle);
    expect(screen.getByText("test")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "收起思考" }));
    expect(screen.queryByText("test")).not.toBeVisible();
  });
});
