import { describe, expect, it } from "vitest";
import { createInitialRun } from "./testRun";

describe("createInitialRun", () => {
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
});
