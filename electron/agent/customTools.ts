import { tool } from "./claudeAgentSdkFacade.js";
import { z } from "zod/v4";

export const generateTestReportTool = tool(
  "generate_test_report",
  "生成一份结构化的测试报告，包含测试步骤执行结果、通过/失败统计和证据链接。在测试执行完成后调用。",
  {
    title: z.string().describe("报告标题"),
    steps: z.array(z.object({
      name: z.string().describe("测试步骤名称"),
      status: z.enum(["passed", "failed", "blocked"]).describe("执行结果"),
      evidence: z.string().optional().describe("证据 ID 或链接"),
      notes: z.string().optional().describe("备注"),
    })).describe("测试步骤列表"),
    summary: z.string().describe("测试结论摘要"),
    totalPassed: z.number().int().min(0).describe("通过数"),
    totalFailed: z.number().int().min(0).describe("失败数"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify({ ...args, generatedAt: Date.now() }, null, 2) }],
  })
);

export const createBugDraftTool = tool(
  "create_bug_draft",
  "创建一个缺陷草稿。在测试发现异常行为或断言失败时调用。",
  {
    title: z.string().describe("缺陷标题"),
    severity: z.enum(["P0", "P1", "P2", "P3"]).describe("严重程度"),
    stepsToReproduce: z.array(z.string()).describe("复现步骤"),
    expectedBehavior: z.string().describe("期望行为"),
    actualBehavior: z.string().describe("实际行为"),
    evidenceIds: z.array(z.string()).optional().describe("关联证据 ID 列表"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify({ ...args, status: "draft", createdAt: Date.now() }, null, 2) }],
  })
);

export const captureEvidenceTool = tool(
  "capture_evidence",
  "记录一条测试证据，可以是截图、API 响应、数据库查询结果或日志片段。",
  {
    title: z.string().describe("证据标题"),
    evidenceType: z.enum(["screenshot", "api_response", "database_record", "log", "dom"]).describe("证据类型"),
    summary: z.string().describe("证据摘要描述"),
    uri: z.string().optional().describe("证据文件 URI"),
    metadata: z.record(z.string(), z.unknown()).optional().describe("额外元数据"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify({ ...args, id: crypto.randomUUID(), capturedAt: Date.now() }, null, 2) }],
  })
);

export const customTools = [generateTestReportTool, createBugDraftTool, captureEvidenceTool];
