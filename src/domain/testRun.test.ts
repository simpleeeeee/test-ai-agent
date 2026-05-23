import { afterEach, describe, expect, it, vi } from "vitest";
import { applyRunEvent, createInitialRun } from "./testRun";

describe("createInitialRun", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a Chinese test run from a natural language prompt", () => {
    const run = createInitialRun({
      prompt: "测试订单模块功能",
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });

    expect(run.title).toBe("测试订单模块功能");
    expect(run.status).toBe("idle");
    expect(run.userPrompt).toBe("测试订单模块功能");
    expect(run.projectName).toBe("电商后台");
    expect(run.environmentName).toBe("QA");
    expect(run.agentName).toBe("订单测试 Agent");
    expect(run.plan).toEqual([]);
    expect(run.toolCalls).toEqual([]);
    expect(run.evidence).toEqual([]);
  });

  it("trims the prompt before using it as title and user prompt", () => {
    const run = createInitialRun({
      prompt: "  测试退款审批流程  ",
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });

    expect(run.title).toBe("测试退款审批流程");
    expect(run.userPrompt).toBe("测试退款审批流程");
  });

  it("uses crypto.randomUUID to create a string id", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "run-123"),
    });

    const run = createInitialRun({
      prompt: "测试登录",
      projectName: "用户中心",
      environmentName: "QA",
      agentName: "登录测试 Agent",
    });

    expect(run.id).toBe("run-123");
    expect(typeof run.id).toBe("string");
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });
});

describe("applyRunEvent", () => {
  it("moves from planning to waiting confirmation when a plan is ready", () => {
    const run = createInitialRun({
      prompt: "测试订单模块功能",
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });

    const planning = applyRunEvent(run, { type: "run:planning" });
    const planned = applyRunEvent(planning, {
      type: "run:plan-ready",
      plan: [
        { id: "step-1", title: "登录测试账号", status: "pending" },
        { id: "step-2", title: "创建测试订单", status: "pending" },
      ],
    });

    expect(planning.status).toBe("planning");
    expect(planned.status).toBe("waiting_confirmation");
    expect(planned.plan).toHaveLength(2);
  });

  it("completes tool calls via updateToolCall", () => {
    const run = createInitialRun({
      prompt: "测试订单模块功能",
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });

    const withTool = applyRunEvent(run, {
      type: "tool:call-started",
      toolCall: { id: "tool-1", toolName: "mcp-test.login", label: "登录", status: "running" },
    });
    const completed = applyRunEvent(withTool, {
      type: "tool:call-completed",
      toolCallId: "tool-1",
      outputSummary: "登录成功",
    });

    expect(completed.toolCalls[0].status).toBe("completed");
    expect(completed.toolCalls[0].outputSummary).toBe("登录成功");
  });

  it("tracks tool calls, evidence, and bug drafts", () => {
    const run = createInitialRun({
      prompt: "测试订单模块功能",
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });

    const withTool = applyRunEvent(run, {
      type: "tool:call-started",
      toolCall: {
        id: "tool-1",
        toolName: "mcp-order.createOrder",
        label: "创建测试订单",
        status: "running",
      },
    });
    const withEvidence = applyRunEvent(withTool, {
      type: "evidence:created",
      evidence: {
        id: "ev-1",
        type: "api_response",
        title: "创建订单响应",
        summary: "订单创建成功",
      },
    });
    const withBug = applyRunEvent(withEvidence, {
      type: "bug-draft:created",
      bugDraft: {
        title: "订单取消后状态未同步",
        severity: "P1",
        steps: ["创建订单", "取消订单", "查询订单状态"],
        expected: "订单状态为已取消",
        actual: "订单状态仍为待支付",
        evidenceIds: ["ev-1"],
      },
    });

    expect(withTool.toolCalls[0].status).toBe("running");
    expect(withEvidence.evidence[0].title).toBe("创建订单响应");
    expect(withBug.bugDraft?.severity).toBe("P1");
  });
});
