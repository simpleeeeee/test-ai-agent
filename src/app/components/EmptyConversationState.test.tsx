import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyConversationState } from "./EmptyConversationState";

describe("EmptyConversationState", () => {
  it("renders compact Chinese guidance for ordinary chat", () => {
    render(<EmptyConversationState />);

    expect(screen.getByRole("heading", { name: "今天想测试什么？" })).toBeInTheDocument();
    expect(screen.getByText("可以直接提问，也可以描述一个业务流程，我会先帮你梳理风险和测试思路。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分析订单模块的关键测试风险" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "帮我设计登录流程的用例" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "解释接口回归测试怎么做" })).toBeInTheDocument();
  });
});
