import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import type { TokenUsage } from "../sdkUiTypes";

describe("Composer", () => {
  it("ignores blank input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="" onChange={vi.fn()} onSubmit={onSubmit} onAddContent={vi.fn()} placeholder="向 AI 测试助手提问…" />);

    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders high-fidelity Chinese controls and submits trimmed text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="  测试订单模块  " onChange={vi.fn()} onSubmit={onSubmit} onAddContent={vi.fn()} placeholder="补充测试指令或继续提问…" />);

    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "补充测试指令或继续提问…");
    expect(screen.queryByPlaceholderText("回复 Claude…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加内容" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith("测试订单模块");
  });

  describe("token info bar", () => {
    it("displays model name when provided", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
        />,
      );

      expect(screen.getByText("Claude Opus 4.8")).toBeInTheDocument();
    });

    it("does not render info bar when modelName and usage are both undefined", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
        />,
      );

      expect(screen.queryByText("context")).not.toBeInTheDocument();
      expect(document.querySelector(".composer-info-bar")).not.toBeInTheDocument();
    });

    it("renders complete token info with formatted values", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 2458,
            outputTokens: 847,
            cacheReadInputTokens: 1230,
            contextTokens: 2100,
            maxContextTokens: 25000,
          }}
        />,
      );

      expect(screen.getByText("2.4k")).toBeInTheDocument();
      expect(screen.getByText("847")).toBeInTheDocument();
      expect(screen.getByText("1.2k")).toBeInTheDocument();
      expect(screen.getByText("context")).toBeInTheDocument();
    });

    it("does not render cache hit tokens when cache hit is zero", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 500,
            outputTokens: 300,
            cacheReadInputTokens: 0,
          }}
        />,
      );

      expect(screen.queryByText("0k")).not.toBeInTheDocument();
    });

    it("does not render cache hit when cache-related fields are undefined", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 500,
            outputTokens: 300,
          }}
        />,
      );

      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("300")).toBeInTheDocument();
      // No k-suffixed values when tokens are under 1000
      const kValues = screen.queryAllByText(/k$/);
      expect(kValues).toHaveLength(0);
    });

    it("displays context usage without progress bar when maxContextTokens is undefined", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 500,
            outputTokens: 300,
            contextTokens: 1200,
          }}
        />,
      );

      expect(screen.getByText("context")).toBeInTheDocument();
      expect(screen.getByText("1.2k")).toBeInTheDocument();
      expect(document.querySelector(".composer-context-bar")).not.toBeInTheDocument();
    });

    it("formats token values at boundaries correctly", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 999,
            outputTokens: 1000,
            cacheReadInputTokens: 1500,
          }}
        />,
      );

      expect(screen.getByText("999")).toBeInTheDocument();    // 999 < 1000
      expect(screen.getByText("1.0k")).toBeInTheDocument();   // 1000 → 1.0k
      expect(screen.getByText("1.5k")).toBeInTheDocument();   // 1500 → 1.5k
    });

    it("displays default placeholder '—' for all token stats when usage is undefined but modelName is set", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
        />,
      );

      // Info bar should be visible
      expect(document.querySelector(".composer-info-bar")).toBeInTheDocument();
      // All token values should show placeholder "—"
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(3); // input, output, context at minimum
    });

    it("renders context tooltip content on hover", async () => {
      const user = userEvent.setup();
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 500,
            outputTokens: 300,
            contextTokens: 2100,
            maxContextTokens: 25000,
          }}
        />,
      );

      const contextZone = screen.getByText("context").closest('[class*="context"]')!;
      await user.hover(contextZone);

      expect(screen.getByText("当前会话 tokens 总量")).toBeInTheDocument();
      expect(screen.getByText(/2,100/)).toBeInTheDocument();
      expect(screen.getByText(/25,000/)).toBeInTheDocument();
      expect(screen.getByText(/LLM 单会话最大容量：25k tokens/)).toBeInTheDocument();
    });

    it("shows counted input tokens when provided", () => {
      render(<Composer value="测试" onChange={vi.fn()} onSubmit={vi.fn()} onAddContent={vi.fn()} placeholder="向 AI 测试助手提问…" modelName="Claude Sonnet 4.6" usage={{ inputTokens: 128, outputTokens: 0 }} />);
      expect(screen.getByText(/128/)).toBeInTheDocument();
    });
  });
});
