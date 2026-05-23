import { describe, expect, it, vi } from "vitest";
import { ApprovalBridge } from "./approvalBridge.js";

describe("ApprovalBridge", () => {
  it("emits approval requests and resolves allow decisions", async () => {
    const emit = vi.fn();
    const bridge = new ApprovalBridge("run-1", emit);
    const decision = bridge.canUseTool("mcp__db__query", { sql: "select 1" }, {
      signal: new AbortController().signal,
      suggestions: [{ destination: "localSettings", rule: "mcp__db__query" }],
    });

    expect(emit).toHaveBeenCalledWith({
      type: "tool:approval-required",
      toolCall: expect.objectContaining({
        toolName: "mcp__db__query",
        status: "waiting_approval",
      }),
    });

    bridge.approve("approval-1", { updatedInput: { sql: "select 1 limit 1" }, applyPermissionSuggestions: true });

    await expect(decision).resolves.toEqual({
      behavior: "allow",
      updatedInput: { sql: "select 1 limit 1" },
      updatedPermissions: [{ destination: "localSettings", rule: "mcp__db__query" }],
    });
  });

  it("resolves deny decisions with a user-facing reason", async () => {
    const bridge = new ApprovalBridge("run-1", vi.fn());
    const decision = bridge.canUseTool("mcp__defect__create", { title: "缺陷" }, {
      signal: new AbortController().signal,
      suggestions: [],
    });

    bridge.deny("approval-1", "用户拒绝创建缺陷");

    await expect(decision).resolves.toEqual({
      behavior: "deny",
      message: "用户拒绝创建缺陷",
    });
  });

  it("emits AskUserQuestion requests and resolves answers", async () => {
    const emit = vi.fn();
    const bridge = new ApprovalBridge("run-1", emit);
    const decision = bridge.canUseTool("AskUserQuestion", {
      questions: [{ question: "选择环境", options: [{ label: "QA" }] }],
    }, {
      signal: new AbortController().signal,
      suggestions: [],
    });

    expect(emit).toHaveBeenCalledWith({
      type: "question:required",
      requestId: "approval-1",
      questions: [{ question: "选择环境", options: [{ label: "QA" }] }],
    });

    bridge.answerQuestion("approval-1", { "选择环境": "QA" });

    await expect(decision).resolves.toEqual({
      behavior: "allow",
      updatedInput: {
        questions: [{ question: "选择环境", options: [{ label: "QA" }] }],
        answers: { "选择环境": "QA" },
      },
    });
  });
});
