import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SdkControlDrawer } from "./SdkControlDrawer";

describe("SdkControlDrawer", () => {
  it("calls every SDK control exposed by the backend bridge", async () => {
    const user = userEvent.setup();
    const bridge = {
      setModel: vi.fn(),
      setPermissionMode: vi.fn(),
      applySettings: vi.fn(),
      supportedModels: vi.fn(),
      supportedCommands: vi.fn(),
      supportedAgents: vi.fn(),
      accountInfo: vi.fn(),
      initializationResult: vi.fn(),
      stopTask: vi.fn(),
    };

    render(<SdkControlDrawer runId="run-1" activeTaskId="task-1" bridge={bridge} />);

    await user.type(screen.getByLabelText("模型"), "gateway-model");
    await user.selectOptions(screen.getByLabelText("权限模式"), "plan");
    // Use fireEvent.change for JSON input since userEvent v14 treats { and } as keyboard modifier descriptors
    fireEvent.change(screen.getByLabelText("Flag Settings JSON"), { target: { value: "{\"maxTurns\":5}" } });
    await user.click(screen.getByRole("button", { name: "应用模型" }));
    await user.click(screen.getByRole("button", { name: "应用权限" }));
    await user.click(screen.getByRole("button", { name: "应用设置" }));
    await user.click(screen.getByRole("button", { name: "支持模型" }));
    await user.click(screen.getByRole("button", { name: "支持命令" }));
    await user.click(screen.getByRole("button", { name: "支持 Agents" }));
    await user.click(screen.getByRole("button", { name: "账号信息" }));
    await user.click(screen.getByRole("button", { name: "初始化结果" }));
    await user.click(screen.getByRole("button", { name: "停止任务" }));

    expect(bridge.setModel).toHaveBeenCalledWith("run-1", "gateway-model");
    expect(bridge.setPermissionMode).toHaveBeenCalledWith("run-1", "plan");
    expect(bridge.applySettings).toHaveBeenCalledWith("run-1", { maxTurns: 5 });
    expect(bridge.supportedModels).toHaveBeenCalledWith("run-1");
    expect(bridge.stopTask).toHaveBeenCalledWith("run-1", "task-1");
  });
});
