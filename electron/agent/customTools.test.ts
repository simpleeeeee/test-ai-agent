import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { customTools, generateTestReportTool, createBugDraftTool, captureEvidenceTool } from "./customTools.js";

describe("customTools", () => {
  it("defines 3 tools", () => {
    expect(customTools).toHaveLength(3);
  });

  it("all tools have valid names and Chinese descriptions", () => {
    for (const t of customTools) {
      expect(t.name).toBeTruthy();
      expect(t.description).toMatch(/[一-鿿]/);
    }
  });

  it("includes all expected tool names", () => {
    const names = customTools.map((t) => t.name);
    expect(names).toContain("generate_test_report");
    expect(names).toContain("create_bug_draft");
    expect(names).toContain("capture_evidence");
  });

  it("generateTestReportTool has the expected name and description", () => {
    expect(generateTestReportTool.name).toBe("generate_test_report");
    expect(generateTestReportTool.description).toContain("测试报告");
  });

  it("createBugDraftTool has the expected name and description", () => {
    expect(createBugDraftTool.name).toBe("create_bug_draft");
    expect(createBugDraftTool.description).toContain("缺陷草稿");
  });

  it("captureEvidenceTool has the expected name and description", () => {
    expect(captureEvidenceTool.name).toBe("capture_evidence");
    expect(captureEvidenceTool.description).toContain("证据");
  });

  // Zod schema validation tests
  describe("Zod input schema validation", () => {
    it("generateTestReportTool rejects empty input", () => {
      const tool = customTools.find((t) => t.name === "generate_test_report")!;
      const schema = z.object(tool.inputSchema);
      expect(() => schema.parse({})).toThrow();
    });

    it("generateTestReportTool accepts valid input", () => {
      const tool = customTools.find((t) => t.name === "generate_test_report")!;
      const schema = z.object(tool.inputSchema);
      const validInput = {
        title: "测试报告",
        steps: [{ name: "登录测试", status: "passed" }],
        summary: "所有测试通过",
        totalPassed: 1,
        totalFailed: 0,
      };
      expect(() => schema.parse(validInput)).not.toThrow();
    });

    it("generateTestReportTool rejects missing required fields", () => {
      const tool = customTools.find((t) => t.name === "generate_test_report")!;
      const schema = z.object(tool.inputSchema);
      // Missing title, steps, summary, totalPassed, totalFailed
      expect(() => schema.parse({ title: "only title" })).toThrow();
    });

    it("createBugDraftTool rejects empty input", () => {
      const tool = customTools.find((t) => t.name === "create_bug_draft")!;
      const schema = z.object(tool.inputSchema);
      expect(() => schema.parse({})).toThrow();
    });

    it("createBugDraftTool accepts valid input", () => {
      const tool = customTools.find((t) => t.name === "create_bug_draft")!;
      const schema = z.object(tool.inputSchema);
      const validInput = {
        title: "登录按钮无响应",
        severity: "P1",
        stepsToReproduce: ["打开登录页", "点击登录按钮"],
        expectedBehavior: "跳转到首页",
        actualBehavior: "无任何反应",
      };
      expect(() => schema.parse(validInput)).not.toThrow();
    });

    it("createBugDraftTool rejects invalid severity", () => {
      const tool = customTools.find((t) => t.name === "create_bug_draft")!;
      const schema = z.object(tool.inputSchema);
      const invalidInput = {
        title: "bug",
        severity: "P5", // 无效值：仅允许 P0-P3
        stepsToReproduce: ["step 1"],
        expectedBehavior: "正常",
        actualBehavior: "异常",
      };
      expect(() => schema.parse(invalidInput)).toThrow();
    });

    it("captureEvidenceTool rejects empty input", () => {
      const tool = customTools.find((t) => t.name === "capture_evidence")!;
      const schema = z.object(tool.inputSchema);
      expect(() => schema.parse({})).toThrow();
    });

    it("captureEvidenceTool accepts valid input", () => {
      const tool = customTools.find((t) => t.name === "capture_evidence")!;
      const schema = z.object(tool.inputSchema);
      const validInput = {
        title: "登录页截图",
        evidenceType: "screenshot",
        summary: "登录页面显示正常",
      };
      expect(() => schema.parse(validInput)).not.toThrow();
    });

    it("captureEvidenceTool rejects invalid evidenceType", () => {
      const tool = customTools.find((t) => t.name === "capture_evidence")!;
      const schema = z.object(tool.inputSchema);
      const invalidInput = {
        title: "evidence",
        evidenceType: "video", // 无效值：仅允许 screenshot/api_response/database_record/log/dom
        summary: "test",
      };
      expect(() => schema.parse(invalidInput)).toThrow();
    });
  });
});
