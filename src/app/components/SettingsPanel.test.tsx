import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";

describe("SettingsPanel", () => {
  const bridge = {
    loadSettings: vi.fn().mockResolvedValue({ baseUrl: "https://api.example.com", apiKey: "key-123", model: "claude-sonnet" }),
    saveSettings: vi.fn(),
  };

  it("renders LLM config fields and theme switch", async () => {
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    expect(screen.getByText("Base URL")).toBeInTheDocument();
    expect(screen.getByText("API Key")).toBeInTheDocument();
    expect(screen.getByText("模型")).toBeInTheDocument();
    expect(screen.getByText("主题")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "浅色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暗色" })).toBeInTheDocument();
  });

  it("calls onClose when clicking overlay", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsPanel bridge={bridge} onClose={onClose} onThemeChange={vi.fn()} theme="light" />);
    await user.click(document.querySelector(".settings-overlay")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onThemeChange with mode", async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={onThemeChange} theme="light" />);
    await user.click(screen.getByRole("button", { name: "暗色" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("submits SDK permission mode and thinking settings", async () => {
    const user = userEvent.setup();
    const onApplySettings = vi.fn();

    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" activeRunId="run-1" onApplySettings={onApplySettings} />);

    await user.selectOptions(screen.getByLabelText("权限模式"), "plan");
    await user.selectOptions(screen.getByLabelText("思考强度"), "high");
    await user.selectOptions(screen.getByLabelText("Thinking 展示"), "summarized");
    await user.click(screen.getByRole("button", { name: "应用设置" }));

    expect(onApplySettings).toHaveBeenCalledWith("run-1", {
      permissionMode: "plan",
      thinking: { effort: "high", display: "summarized" },
    });
  });

  it("renders effort select with Chinese labels", async () => {
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    await screen.findByLabelText("推理努力程度");
    expect(screen.getByRole("option", { name: "低" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "高" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "最大" })).toBeInTheDocument();
  });

  it("renders sandbox toggle switch", async () => {
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    await screen.findByText("沙箱保护");
    expect(screen.getByText("开")).toBeInTheDocument();
    expect(screen.getByText("关")).toBeInTheDocument();
  });

  it("saves effort on change", async () => {
    const saveSettings = vi.fn();
    const bridge = { loadSettings: () => Promise.resolve({ baseUrl: "", apiKey: "", model: "" }), saveSettings };
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    await screen.findByLabelText("推理努力程度");
    fireEvent.change(screen.getByLabelText("推理努力程度"), { target: { value: "max" } });
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ effort: "max" }));
  });

  it("saves sandboxEnabled on toggle", async () => {
    const saveSettings = vi.fn();
    const bridge = { loadSettings: () => Promise.resolve({ baseUrl: "", apiKey: "", model: "" }), saveSettings };
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    await screen.findByText("沙箱保护");
    fireEvent.click(screen.getByText("开"));
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ sandboxEnabled: true }));
  });

  it("shows 已连接 when connectionStatus state is connected", async () => {
    const connectionStatus = {
      state: "connected" as const,
      baseUrl: "https://api.example.com",
      model: "claude-sonnet",
      probedAt: Date.now(),
    };
    render(
      <SettingsPanel
        bridge={bridge}
        onClose={vi.fn()}
        onThemeChange={vi.fn()}
        theme="light"
        connectionStatus={connectionStatus}
      />,
    );
    expect(screen.getByText("已连接")).toBeInTheDocument();
  });

  it("shows 连接失败 and clicking reveals error detail with Chinese message", async () => {
    const user = userEvent.setup();
    const connectionStatus = {
      state: "failed" as const,
      baseUrl: "https://api.example.com",
      model: "claude-sonnet",
      probedAt: Date.now(),
      error: {
        code: "AUTH_ERROR",
        message: "API 密钥无效，请检查后重试",
        suggestion: "请在 API Key 字段中更新密钥后重新测试连接",
      },
    };
    render(
      <SettingsPanel
        bridge={bridge}
        onClose={vi.fn()}
        onThemeChange={vi.fn()}
        theme="light"
        connectionStatus={connectionStatus}
      />,
    );
    expect(screen.getByText("连接失败")).toBeInTheDocument();

    // Error detail should not be visible initially
    expect(screen.queryByText("API 密钥无效，请检查后重试")).not.toBeInTheDocument();

    // Click the indicator to reveal error detail
    const indicator = screen.getByRole("button", { name: /连接失败/ });
    await user.click(indicator);

    expect(screen.getByText("API 密钥无效，请检查后重试")).toBeInTheDocument();
    expect(screen.getByText("请在 API Key 字段中更新密钥后重新测试连接")).toBeInTheDocument();
  });
});
