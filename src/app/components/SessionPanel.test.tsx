import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionPanel } from "./SessionPanel";

describe("SessionPanel", () => {
  it("exposes every SDK session operation", async () => {
    const user = userEvent.setup();
    const bridge = {
      listSessions: vi.fn(),
      getSession: vi.fn(),
      resumeSession: vi.fn(),
      forkSession: vi.fn(),
      continueRun: vi.fn(),
      renameSession: vi.fn(),
      tagSession: vi.fn(),
      deleteSession: vi.fn(),
    };

    render(<SessionPanel runId="run-1" sessions={[{ id: "session-1", title: "订单回归", tags: ["P1"] }]} bridge={bridge} />);

    await user.click(screen.getByRole("button", { name: "刷新会话" }));
    await user.click(screen.getByRole("button", { name: "查看" }));
    await user.click(screen.getByRole("button", { name: "恢复" }));
    await user.click(screen.getByRole("button", { name: "Fork" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "重命名" }));
    await user.click(screen.getByRole("button", { name: "打标签" }));
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(bridge.listSessions).toHaveBeenCalled();
    expect(bridge.getSession).toHaveBeenCalledWith("session-1");
    expect(bridge.resumeSession).toHaveBeenCalledWith("run-1", "session-1");
    expect(bridge.forkSession).toHaveBeenCalledWith("run-1", "session-1");
    expect(bridge.continueRun).toHaveBeenCalledWith("run-1");
    expect(bridge.renameSession).toHaveBeenCalledWith("session-1", "订单回归 已更新");
    expect(bridge.tagSession).toHaveBeenCalledWith("session-1", "reviewed");
    expect(bridge.deleteSession).toHaveBeenCalledWith("session-1");
  });
});
