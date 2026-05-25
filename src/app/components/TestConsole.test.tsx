import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestConsole } from "./TestConsole";

describe("TestConsole", () => {
  it("renders high-fidelity Chinese monitor content and controls", async () => {
    const user = userEvent.setup();
    const onApprovePlan = vi.fn();
    const onStopTask = vi.fn();

    render(
      <TestConsole
        activeTaskId="task-3"
        mcpServers={[
          { name: "browser", status: "connected" },
          { name: "api", status: "failed" },
          { name: "auth", status: "needs-auth" },
        ]}
        tasks={[
          { taskId: "task-1", summary: "打开订单列表" },
          { taskId: "task-2", summary: "筛选待支付订单" },
          { taskId: "task-3", summary: "执行订单状态检查" },
        ]}
        evidence={[
          { id: "evidence-1", type: "screenshot", title: "订单截图", summary: "订单状态显示异常" },
          { id: "evidence-2", type: "log", title: "接口日志", summary: "重复回调" },
        ]}
        bugDraft={{
          title: "支付回调重复通知导致状态异常",
          severity: "P1",
          steps: ["创建订单", "重复回调"],
          expected: "订单保持已支付",
          actual: "订单状态回退",
          evidenceIds: ["evidence-1"],
        }}
        onApprovePlan={onApprovePlan}
        onStopTask={onStopTask}
      />,
    );

    expect(screen.getByRole("complementary", { name: "测试监控台" })).toBeInTheDocument();
    expect(screen.getByText("计划进度")).toBeInTheDocument();
    expect(screen.getByText("3 / 5 个场景 · 执行订单状态检查")).toBeInTheDocument();
    expect(screen.getByLabelText("测试进度").querySelector("span")).toHaveStyle({ width: "60%" });
    expect(screen.getByText("浏览器")).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();
    expect(screen.getByText("接口")).toBeInTheDocument();
    expect(screen.getByText("连接失败")).toBeInTheDocument();
    expect(screen.getByText("需要授权")).toBeInTheDocument();
    expect(screen.getByText("认证")).toBeInTheDocument();
    expect(screen.getByText("截图 1 张 · 日志 1 条")).toBeInTheDocument();
    expect(screen.getByText("支付回调重复通知导致状态异常")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认执行" }));
    await user.click(screen.getByRole("button", { name: "停止" }));

    expect(onApprovePlan).toHaveBeenCalledTimes(1);
    expect(onStopTask).toHaveBeenCalledWith("task-3");
  });
});
