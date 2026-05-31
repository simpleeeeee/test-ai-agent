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
});
