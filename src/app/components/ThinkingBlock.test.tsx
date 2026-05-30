import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThinkingBlock } from "./ThinkingBlock";

describe("ThinkingBlock", () => {
  it("renders collapsed by default with thinking indicator", () => {
    render(<ThinkingBlock duration="1.2s"><p>推理内容</p></ThinkingBlock>);
    expect(screen.getByText("思考中…")).toBeInTheDocument();
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.queryByText("推理内容")).not.toBeVisible();
  });

  it("expands and shows content on click", async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock duration="0.8s"><p>选择 B 方案</p></ThinkingBlock>);
    await user.click(screen.getByText("思考中…"));
    expect(screen.getByText("选择 B 方案")).toBeVisible();
  });

  it("collapses on second click", async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock duration="1s"><p>test</p></ThinkingBlock>);
    const header = screen.getByText("思考中…");
    await user.click(header);
    expect(screen.getByText("test")).toBeVisible();
    await user.click(header);
    expect(screen.queryByText("test")).not.toBeVisible();
  });
});
