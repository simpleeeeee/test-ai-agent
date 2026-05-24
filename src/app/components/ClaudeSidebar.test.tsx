import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClaudeSidebar } from "./ClaudeSidebar";

describe("ClaudeSidebar", () => {
  it("renders Claude-style Chinese navigation and resumes recent sessions", async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();
    const onResumeSession = vi.fn();
    const onViewAll = vi.fn();

    render(
      <ClaudeSidebar
        activeRunId="run-2"
        sessions={[
          { id: "run-1", title: "今天的咨询", tags: [] },
          { id: "run-2", title: "订单模块回归", tags: ["测试"] },
        ]}
        onNewChat={onNewChat}
        onResumeSession={onResumeSession}
        onViewAll={onViewAll}
      />,
    );

    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建聊天" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "对话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目" })).toBeInTheDocument();
    expect(screen.getByText("最近")).toBeInTheDocument();
    expect(screen.getByText("订单模块回归")).toBeInTheDocument();
    expect(screen.getByText("专业版")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建聊天" }));
    await user.click(screen.getByRole("button", { name: "今天的咨询" }));
    await user.click(screen.getByRole("button", { name: "查看全部" }));

    expect(onNewChat).toHaveBeenCalled();
    expect(onResumeSession).toHaveBeenCalledWith("run-1");
    expect(onViewAll).toHaveBeenCalled();
  });
});
