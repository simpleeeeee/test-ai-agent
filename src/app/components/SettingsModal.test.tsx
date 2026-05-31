import { render, screen } from "@testing-library/react";
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
});
