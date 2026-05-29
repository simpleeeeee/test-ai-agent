import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SdkControlDrawer } from "./SdkControlDrawer";

describe("SdkControlDrawer", () => {
  it("loads settings on mount and saves with updated values", async () => {
    const user = userEvent.setup();
    const onModelSaved = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge: any = {
      loadSettings: vi.fn().mockResolvedValue({
        baseUrl: "https://gateway.example.com/anthropic",
        apiKey: "plain-text-key",
        model: "claude-sonnet-4",
      }),
      saveSettings: vi.fn().mockResolvedValue(undefined),
    };

    render(<SdkControlDrawer bridge={bridge} onModelSaved={onModelSaved} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://gateway.example.com/anthropic")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("plain-text-key")).toBeInTheDocument();
    expect(screen.getByDisplayValue("claude-sonnet-4")).toBeInTheDocument();

    await user.clear(screen.getByDisplayValue("claude-sonnet-4"));
    await user.type(screen.getByLabelText("模型名称"), "claude-opus-4");
    await user.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(bridge.saveSettings).toHaveBeenCalledWith({
        baseUrl: "https://gateway.example.com/anthropic",
        apiKey: "plain-text-key",
        model: "claude-opus-4",
      });
    });
    expect(onModelSaved).toHaveBeenCalledWith("claude-opus-4");
    expect(screen.getByText("设置已保存")).toBeInTheDocument();
  });

  it("renders empty form when loadSettings is not yet resolved", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge: any = {
      loadSettings: vi.fn(() => new Promise(() => {})),
      saveSettings: vi.fn().mockResolvedValue(undefined),
    };

    render(<SdkControlDrawer bridge={bridge} />);

    expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("模型名称")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存设置" })).toBeInTheDocument();
  });
});
