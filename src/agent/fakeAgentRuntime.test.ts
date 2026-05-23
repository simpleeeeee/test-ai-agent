import { describe, expect, it } from "vitest";
import { runFakeAgent } from "./fakeAgentRuntime";

describe("runFakeAgent", () => {
  it("streams a plan and MCP tool events for an order module prompt", async () => {
    const events = [];

    for await (const event of runFakeAgent("测试订单模块功能")) {
      events.push(event);
    }

    expect(events[0]).toEqual({ type: "run:planning" });
    expect(events).toContainEqual({
      type: "run:plan-ready",
      plan: [
        { id: "plan-login", title: "登录测试账号", status: "pending" },
        { id: "plan-create-order", title: "创建测试订单", status: "pending" },
        { id: "plan-update-order", title: "修改订单信息", status: "pending" },
        { id: "plan-check-status", title: "校验订单状态", status: "pending" },
      ],
    });
    expect(events).toContainEqual({
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
});
