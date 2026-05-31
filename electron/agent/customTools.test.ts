import { describe, expect, it } from "vitest";
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
});
