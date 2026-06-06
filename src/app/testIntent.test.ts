import { describe, expect, it } from "vitest";
import { isExplicitTestExecutionRequest, isTestPlanRequest } from "./testIntent";

describe("isExplicitTestExecutionRequest", () => {
  it("detects test execution phrases starting with 测试 followed by a feature name", () => {
    expect(isExplicitTestExecutionRequest("测试订单模块功能")).toBe(true);
    expect(isExplicitTestExecutionRequest("测试登录页面")).toBe(true);
    expect(isExplicitTestExecutionRequest("测试支付流程")).toBe(true);
  });

  it("does not flag planning or chat messages as test execution", () => {
    expect(isExplicitTestExecutionRequest("生成测试计划")).toBe(false);
    expect(isExplicitTestExecutionRequest("你好")).toBe(false);
    expect(isExplicitTestExecutionRequest("帮我分析一下这个接口")).toBe(false);
    expect(isExplicitTestExecutionRequest("介绍一下你能做什么")).toBe(false);
  });

  it("does not flag standalone 测试 without a feature description", () => {
    expect(isExplicitTestExecutionRequest("测试")).toBe(false);
  });

  it("returns false for empty or whitespace-only input", () => {
    expect(isExplicitTestExecutionRequest("")).toBe(false);
    expect(isExplicitTestExecutionRequest("   ")).toBe(false);
  });
});

describe("isTestPlanRequest", () => {
  it("detects explicit test plan prompts", () => {
    expect(isTestPlanRequest("生成测试计划")).toBe(true);
    expect(isTestPlanRequest("制定 测试计划")).toBe(true);
    expect(isTestPlanRequest("帮我输出测试方案")).toBe(true);
  });

  it("does not flag ordinary chat or execution prompts", () => {
    expect(isTestPlanRequest("你好")).toBe(false);
    expect(isTestPlanRequest("测试订单模块功能")).toBe(false);
    expect(isTestPlanRequest("")).toBe(false);
    expect(isTestPlanRequest("   ")).toBe(false);
  });
});
