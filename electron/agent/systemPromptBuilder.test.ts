import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./systemPromptBuilder.js";
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from "./claudeAgentSdkFacade.js";

describe("buildSystemPrompt", () => {
  it("places SYSTEM_PROMPT_DYNAMIC_BOUNDARY between static and dynamic parts", () => {
    const ctx = {
      staticParts: ["你是 AI 测试助手。", "遵循 TDD 原则。"],
      dynamicContext: {
        currentTime: "2026-05-31 12:00",
        userName: "测试员",
        projectName: "订单系统",
        environmentName: "UAT",
        sessionId: "session-123",
      },
    };
    const prompt = buildSystemPrompt(ctx);
    const boundaryIndex = prompt.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
    expect(boundaryIndex).toBeGreaterThan(0);
    const before = prompt.slice(0, boundaryIndex);
    const after = prompt.slice(boundaryIndex + SYSTEM_PROMPT_DYNAMIC_BOUNDARY.length);
    expect(before).toContain("AI 测试助手");
    expect(after).toContain("session-123");
  });

  it("includes all static parts joined with double newlines", () => {
    const ctx = {
      staticParts: ["第一部分", "第二部分", "第三部分"],
      dynamicContext: {
        currentTime: "now",
        userName: "user",
        projectName: "project",
        environmentName: "env",
        sessionId: "sid",
      },
    };
    const prompt = buildSystemPrompt(ctx);
    const boundaryIndex = prompt.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
    const staticBlock = prompt.slice(0, boundaryIndex);
    expect(staticBlock).toContain("第一部分\n\n第二部分\n\n第三部分");
  });

  it("includes all dynamic context fields", () => {
    const ctx = {
      staticParts: ["静态部分"],
      dynamicContext: {
        currentTime: "2026-06-01 09:00",
        userName: "张三",
        projectName: "支付系统",
        environmentName: "STAGING",
        sessionId: "abc-456",
      },
    };
    const prompt = buildSystemPrompt(ctx);
    const boundaryIndex = prompt.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
    const after = prompt.slice(boundaryIndex + SYSTEM_PROMPT_DYNAMIC_BOUNDARY.length);
    expect(after).toContain("当前时间：2026-06-01 09:00");
    expect(after).toContain("用户：张三");
    expect(after).toContain("项目：支付系统");
    expect(after).toContain("测试环境：STAGING");
    expect(after).toContain("会话：abc-456");
  });
});
