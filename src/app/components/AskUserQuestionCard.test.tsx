import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AskUserQuestionCard } from "./AskUserQuestionCard";

describe("AskUserQuestionCard", () => {
  it("collects multi-choice and free-text answers", async () => {
    const user = userEvent.setup();
    const answer = vi.fn();

    render(<AskUserQuestionCard request={{
      runId: "run-1",
      requestId: "question-1",
      questions: [
        { id: "scope", label: "测试范围", options: ["冒烟", "回归"] },
        { id: "note", label: "补充说明" },
      ],
    }} onAnswer={answer} />);

    await user.selectOptions(screen.getByLabelText("测试范围"), "回归");
    await user.type(screen.getByLabelText("补充说明"), "覆盖优惠券");
    await user.click(screen.getByRole("button", { name: "提交回答" }));

    expect(answer).toHaveBeenCalledWith("run-1", "question-1", {
      scope: "回归",
      note: "覆盖优惠券",
    });
  });
});
