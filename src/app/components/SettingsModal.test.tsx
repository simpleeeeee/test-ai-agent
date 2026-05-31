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
});
