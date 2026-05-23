import type { RunEvent } from "../domain/testRun";

export async function* runFakeAgent(prompt: string): AsyncGenerator<RunEvent> {
  const normalizedPrompt = prompt.trim();

  yield { type: "run:planning" };

  if (normalizedPrompt.includes("订单")) {
    yield {
      type: "run:plan-ready",
      plan: [
        { id: "plan-login", title: "登录测试账号", status: "pending" },
        { id: "plan-create-order", title: "创建测试订单", status: "pending" },
        { id: "plan-update-order", title: "修改订单信息", status: "pending" },
        { id: "plan-check-status", title: "校验订单状态", status: "pending" },
      ],
    };
    yield { type: "run:status-changed", status: "running" };
    yield {
      type: "tool:call-started",
      toolCall: {
        id: "tool-login",
        toolName: "mcp-user.login",
        label: "登录测试账号",
        status: "running",
      },
    };
    yield {
      type: "tool:call-completed",
      toolCallId: "tool-login",
      outputSummary: "测试账号登录成功",
    };
    yield {
      type: "tool:approval-required",
      toolCall: {
        id: "tool-query-order",
        toolName: "mcp-db.queryOrder",
        label: "查询订单数据库",
        status: "waiting_approval",
        approvalReason: "AI 请求查询订单数据库",
      },
    };
    return;
  }

  yield {
    type: "run:plan-ready",
    plan: [{ id: "plan-generic", title: "分析测试目标", status: "pending" }],
  };
}
