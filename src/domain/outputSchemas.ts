export type OutputSchemaTemplate = {
  id: string;
  label: string;
  description: string;
  outputFormat: {
    type: "json_schema";
    json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
  } | null; // null for "custom" template
};

export const OUTPUT_SCHEMA_TEMPLATES: OutputSchemaTemplate[] = [
  {
    id: "test_plan",
    label: "测试计划",
    description: "生成包含步骤、预期结果和优先级的结构化测试计划",
    outputFormat: {
      type: "json_schema",
      json_schema: {
        name: "test_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            planName: { type: "string" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  stepId: { type: "string" },
                  title: { type: "string" },
                  expectedResult: { type: "string" },
                  priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
                },
                required: ["stepId", "title", "expectedResult"],
              },
            },
          },
          required: ["planName", "steps"],
        },
      },
    },
  },
  {
    id: "bug_report",
    label: "缺陷报告",
    description: "生成包含标题、严重程度、复现步骤的结构化缺陷报告",
    outputFormat: {
      type: "json_schema",
      json_schema: {
        name: "bug_report",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            severity: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
            stepsToReproduce: { type: "array", items: { type: "string" } },
            expectedBehavior: { type: "string" },
            actualBehavior: { type: "string" },
            evidenceIds: { type: "array", items: { type: "string" } },
          },
          required: ["title", "severity", "stepsToReproduce", "expectedBehavior", "actualBehavior"],
        },
      },
    },
  },
  {
    id: "evidence_summary",
    label: "测试证据摘要",
    description: "生成证据的结构化摘要",
    outputFormat: {
      type: "json_schema",
      json_schema: {
        name: "evidence_summary",
        strict: true,
        schema: {
          type: "object",
          properties: {
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  type: { type: "string", enum: ["screenshot", "api_response", "database_record", "log", "dom"] },
                  summary: { type: "string" },
                  uri: { type: "string" },
                },
                required: ["id", "title", "type", "summary"],
              },
            },
          },
          required: ["evidence"],
        },
      },
    },
  },
  {
    id: "custom",
    label: "自定义 Schema",
    description: "手动输入自定义 JSON Schema",
    outputFormat: null,
  },
];
