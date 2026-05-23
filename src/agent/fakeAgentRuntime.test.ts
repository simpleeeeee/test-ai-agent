import { describe, expect, it } from "vitest";
import { runFakeAgent } from "./fakeAgentRuntime";

describe("runFakeAgent", () => {
  it("streams a plan and MCP tool events for an order module prompt", async () => {
    const events = [];

    for await (const event of runFakeAgent("测试订单模块功能")) {
      events.push(event);
    }

    expect(events).toHaveLength(7);
    expect(events[0]).toEqual({ type: "run:planning" });
    expect(events[1]).toEqual({
      type: "run:plan-ready",
      plan: [
        { id: "plan-login", title: "登录测试账号", status: "pending" },
        { id: "plan-create-order", title: "创建测试订单", status: "pending" },
        { id: "plan-update-order", title: "修改订单信息", status: "pending" },
        { id: "plan-check-status", title: "校验订单状态", status: "pending" },
      ],
    });
    expect(events[2]).toEqual({ type: "run:status-changed", status: "running" });
    expect(events[3]).toEqual({
      type: "tool:call-started",
      toolCall: {
        id: "tool-login",
        toolName: "mcp-user.login",
        label: "登录测试账号",
        status: "running",
      },
    });
    expect(events[4]).toEqual({
      type: "tool:call-completed",
      toolCallId: "tool-login",
      outputSummary: "测试账号登录成功",
    });
    expect(events[5]).toEqual({
      type: "tool:call-started",
      toolCall: {
        id: "tool-query-order",
        toolName: "mcp-db.queryOrder",
        label: "查询订单数据库",
        status: "running",
      },
    });
    expect(events[6]).toEqual({
      type: "tool:approval-required",
      toolCall: {
        id: "tool-query-order",
        toolName: "mcp-db.queryOrder",
        label: "查询订单数据库",
        status: "waiting_approval",
        approvalReason: "AI 请求查询订单数据库",
      },
    });
  });

  it("streams a generic plan for a non-order prompt", async () => {
    const events = [];
    for await (const event of runFakeAgent("通用测试")) {
      events.push(event);
    }
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: "run:planning" });
    expect(events[1]).toEqual({
      type: "run:plan-ready",
      plan: [{ id: "plan-generic", title: "分析测试目标", status: "pending" }],
    });
  });
});
