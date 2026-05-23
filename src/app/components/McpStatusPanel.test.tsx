import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { McpStatusPanel } from "./McpStatusPanel";

describe("McpStatusPanel", () => {
  it("renders every MCP state and exposes reconnect and toggle controls", async () => {
    const user = userEvent.setup();
    const bridge = { reconnectMcpServer: vi.fn(), toggleMcpServer: vi.fn(), mcpStatus: vi.fn() };

    render(<McpStatusPanel runId="run-1" bridge={bridge} servers={[
      { name: "browser", status: "connected" },
      { name: "db", status: "failed" },
      { name: "auth", status: "needs-auth" },
      { name: "slow", status: "pending" },
      { name: "legacy", status: "disabled" },
    ]} />);

    expect(screen.getByText("browser")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("needs-auth")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "刷新 MCP" }));
    await user.click(screen.getAllByRole("button", { name: "重连" })[0]);
    await user.click(screen.getAllByRole("button", { name: "切换" })[0]);

    expect(bridge.mcpStatus).toHaveBeenCalledWith("run-1");
    expect(bridge.reconnectMcpServer).toHaveBeenCalledWith("run-1", "browser");
    expect(bridge.toggleMcpServer).toHaveBeenCalledWith("run-1", "browser", false);
  });
});
