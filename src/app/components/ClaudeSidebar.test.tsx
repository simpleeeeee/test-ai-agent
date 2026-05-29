import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClaudeSidebar } from "./ClaudeSidebar";

describe("ClaudeSidebar", () => {
  it("renders AI 测试助手 navigation and resumes recent sessions", async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();
    const onSelectConversation = vi.fn();
    const onSelectProjects = vi.fn();
    const onResumeSession = vi.fn();

    render(
      <ClaudeSidebar
        activeRunId="run-2"
        sessions={[
          { id: "run-1", title: "今天的咨询", tags: [] },
          { id: "run-2", title: "订单模块回归", tags: ["测试"] },
        ]}
        onNewChat={onNewChat}
        onSelectConversation={onSelectConversation}
        onSelectProjects={onSelectProjects}
        onResumeSession={onResumeSession}
      />,
    );

    expect(screen.getByText("AI 测试助手")).toBeInTheDocument();
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建聊天" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "对话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目" })).toBeInTheDocument();
    expect(screen.getByText("最近")).toBeInTheDocument();
    expect(screen.getByText("订单模块回归")).toBeInTheDocument();
    expect(screen.getByText("专业版")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看全部" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建聊天" }));
    await user.click(screen.getByRole("button", { name: "今天的咨询" }));

    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onResumeSession).toHaveBeenCalledWith("run-1");
  });

  it("shows a compact empty state when no recent sessions exist", () => {
    render(
      <ClaudeSidebar
        sessions={[]}
        onNewChat={vi.fn()}
        onSelectConversation={vi.fn()}
        onSelectProjects={vi.fn()}
        onResumeSession={vi.fn()}
      />,
    );

    expect(screen.getByText("暂无最近对话")).toBeInTheDocument();
  });
});
