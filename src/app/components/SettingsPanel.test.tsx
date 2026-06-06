import { render, screen, waitFor } from "@testing-library/react";
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
    await waitFor(() => {
      expect(screen.getByDisplayValue("https://api.example.com")).toBeInTheDocument();
    });
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
    await waitFor(() => {
      expect(bridge.loadSettings).toHaveBeenCalled();
    });
    await user.click(document.querySelector(".settings-overlay")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onThemeChange with mode", async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={onThemeChange} theme="light" />);
    await waitFor(() => {
      expect(bridge.loadSettings).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "暗色" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });
});
