import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialRun } from "./testRun";

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
