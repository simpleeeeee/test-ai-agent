export interface OutputSchemaTemplate {
  id: string;
  label: string;
  description: string;
  schema: Record<string, unknown>;
}

export const OUTPUT_SCHEMA_TEMPLATES: OutputSchemaTemplate[] = [
  {
    id: "test_plan",
    label: "测试计划",
    description: "生成结构化测试计划",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step: { type: "string" },
              expected: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    id: "bug_report",
    label: "缺陷报告",
    description: "生成结构化缺陷报告",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        severity: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
        steps: { type: "array", items: { type: "string" } },
        expected: { type: "string" },
        actual: { type: "string" },
      },
    },
  },
  {
    id: "custom",
    label: "自定义",
    description: "使用自定义 JSON Schema",
    schema: {},
  },
];
