import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToolCallCard } from "./ToolCallCard";

describe("ToolCallCard", () => {
  it("renders tool name with active indicator and status", () => {
    render(<ToolCallCard toolName="Read" summary="src/test.ts" status="active" statusText="执行中…" />);
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("src/test.ts")).toBeInTheDocument();
    expect(screen.getByText("执行中…")).toBeInTheDocument();
  });

  it("renders done status with timing", () => {
    render(<ToolCallCard toolName="Bash" summary="npm test" status="done" statusText="42ms" />);
    expect(screen.getByText("42ms")).toBeInTheDocument();
  });

  it("toggles output on click when output provided", async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolName="Read" summary="test.ts" status="done" statusText="3ms" output="文件内容…" />);
    await user.click(screen.getByText("查看输出"));
    expect(screen.getByText("文件内容…")).toBeVisible();
  });

  it("does not render toggle when no output", () => {
    render(<ToolCallCard toolName="Read" summary="test.ts" status="active" statusText="执行中…" />);
    expect(screen.queryByText("查看输出")).not.toBeInTheDocument();
  });

  it("shows streamed tool input when available", () => {
    render(
      <ToolCallCard
        toolName="mcp__browser__navigate"
        summary="导航"
        status="active"
        statusText="执行中…"
        streamedInput={'{"url":"https://example.com"}'}
      />,
    );
    expect(screen.getByText(/https:\/\/example\.com/)).toBeInTheDocument();
  });
});
