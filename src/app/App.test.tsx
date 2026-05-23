import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App shell", () => {
  it("turns a Chinese prompt into a plan awaiting confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("测试目标"), "测试订单模块功能");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("测试订单模块功能")).toBeInTheDocument();
    expect(await screen.findByText("我将基于订单模块的测试工具生成执行计划。")).toBeInTheDocument();
    expect(await screen.findByText("测试计划")).toBeInTheDocument();
    expect(screen.getByText("登录测试账号")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始执行" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "调整计划" })).toBeInTheDocument();
  });

  it("renders a Chinese Claude Desktop style conversation workspace", () => {
    render(<App />);

    expect(screen.getByText("AI 测试助手")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建测试" })).toBeInTheDocument();
    expect(screen.getAllByText("订单模块测试")).toHaveLength(2);
    expect(screen.getByPlaceholderText("输入你想测试的功能，例如：测试订单模块功能")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送" })).toBeInTheDocument();
    expect(screen.getByText("空闲")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByText("输入测试目标，AI 会生成计划并调用 MCP 工具执行。")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
