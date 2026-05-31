import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";

describe("SettingsModal", () => {
  const bridge = {
    loadSettings: vi.fn().mockResolvedValue({ baseUrl: "", apiKey: "", model: "" }),
    saveSettings: vi.fn(),
  };

  it("renders modal with title and close button", () => {
    render(<SettingsModal bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    expect(screen.getByText("设置")).toBeInTheDocument();
    expect(screen.getByTitle("关闭")).toBeInTheDocument();
  });

  it("renders 6 navigation items", () => {
    render(<SettingsModal bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    expect(screen.getByText("连接")).toBeInTheDocument();
    expect(screen.getByText("对话")).toBeInTheDocument();
    expect(screen.getByText("外观")).toBeInTheDocument();
    expect(screen.getByText("安全")).toBeInTheDocument();
    expect(screen.getByText("输出")).toBeInTheDocument();
    expect(screen.getByText("调试")).toBeInTheDocument();
  });

  it("shows connection panel by default with Base URL, API Key and model fields", () => {
    render(<SettingsModal bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    expect(screen.getByText("API 连接配置")).toBeInTheDocument();
    expect(screen.getByText("Base URL")).toBeInTheDocument();
    expect(screen.getByText("API Key")).toBeInTheDocument();
    expect(screen.getByText("模型")).toBeInTheDocument();
  });

  it("switches panel when clicking nav items", async () => {
    const user = userEvent.setup();
    render(<SettingsModal bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);

    // Click 外观 nav → see 主题模式
    await user.click(screen.getByText("外观"));
    expect(screen.getByText("主题模式")).toBeInTheDocument();
    expect(screen.queryByText("API 连接配置")).not.toBeInTheDocument();

    // Click 连接 nav → back to connection
    await user.click(screen.getByText("连接"));
    expect(screen.getByText("API 连接配置")).toBeInTheDocument();
  });

  it("calls onClose when clicking overlay", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onClose = vi.fn();
    render(<SettingsModal bridge={bridge} onClose={onClose} onThemeChange={vi.fn()} theme="light" />);
    await user.click(document.querySelector(".settings-modal-overlay")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking close button", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onClose = vi.fn();
    render(<SettingsModal bridge={bridge} onClose={onClose} onThemeChange={vi.fn()} theme="light" />);
    await user.click(screen.getByTitle("关闭"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onThemeChange when switching theme", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onThemeChange = vi.fn();
    render(<SettingsModal bridge={bridge} onClose={vi.fn()} onThemeChange={onThemeChange} theme="light" />);

    await user.click(screen.getByText("外观"));
    await user.click(screen.getByRole("button", { name: "暗色" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("renders conversation panel with SDK settings and Chinese labels", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<SettingsModal bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);

    await user.click(screen.getByText("对话"));

    expect(screen.getByText("SDK 会话配置")).toBeInTheDocument();
    expect(screen.getByLabelText("权限模式")).toBeInTheDocument();
    expect(screen.getByLabelText("思考强度")).toBeInTheDocument();
    expect(screen.getByLabelText("Thinking 展示")).toBeInTheDocument();
    expect(screen.getByLabelText("推理努力程度")).toBeInTheDocument();

    // 推理努力程度使用中文标签
    expect(screen.getByRole("option", { name: "低" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "高" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "最大" })).toBeInTheDocument();
  });

  it("shows 已连接 when connectionStatus state is connected", () => {
    const connectionStatus = {
      state: "connected" as const,
      baseUrl: "https://api.example.com",
      model: "claude-sonnet",
      probedAt: Date.now(),
    };
    render(
      <SettingsModal bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" connectionStatus={connectionStatus} />,
    );
    expect(screen.getByText("已连接")).toBeInTheDocument();
  });

  it("saves effort on change", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const saveSettings = vi.fn();
    const b = { loadSettings: () => Promise.resolve({ baseUrl: "", apiKey: "", model: "" }), saveSettings };
    render(<SettingsModal bridge={b} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);

    await user.click(screen.getByText("对话"));
    await user.selectOptions(screen.getByLabelText("推理努力程度"), "max");
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ effort: "max" }));
  });

  it("shows error detail when clicking failed connection status", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
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
      <SettingsModal bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" connectionStatus={connectionStatus} />,
    );
    expect(screen.getByText("连接失败")).toBeInTheDocument();
    expect(screen.queryByText("API 密钥无效，请检查后重试")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /连接失败/ }));
    expect(screen.getByText("API 密钥无效，请检查后重试")).toBeInTheDocument();
    expect(screen.getByText("请在 API Key 字段中更新密钥后重新测试连接")).toBeInTheDocument();
  });
});
