import { describe, expect, it } from "vitest";
import { OUTPUT_SCHEMA_TEMPLATES, type OutputSchemaTemplate } from "./outputSchemas";

describe("OUTPUT_SCHEMA_TEMPLATES", () => {
  it("contains exactly 4 templates", () => {
    expect(OUTPUT_SCHEMA_TEMPLATES).toHaveLength(4);
  });

  it("has correct template ids", () => {
    const ids = OUTPUT_SCHEMA_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["test_plan", "bug_report", "evidence_summary", "custom"]);
  });

  it("every template has a non-empty label and description", () => {
    for (const t of OUTPUT_SCHEMA_TEMPLATES) {
      expect(t.label).toBeTruthy();
      expect(typeof t.label).toBe("string");
      expect(t.description).toBeTruthy();
      expect(typeof t.description).toBe("string");
    }
  });

  it("test_plan has non-null outputFormat with correct structure", () => {
    const tp = OUTPUT_SCHEMA_TEMPLATES.find((t) => t.id === "test_plan");
    expect(tp).toBeDefined();
    expect(tp!.outputFormat).not.toBeNull();
    expect(tp!.outputFormat!.type).toBe("json_schema");
    expect(tp!.outputFormat!.json_schema.name).toBe("test_plan");
    expect(tp!.outputFormat!.json_schema.strict).toBe(true);
    expect(tp!.outputFormat!.json_schema.schema).toBeDefined();
    expect(typeof tp!.outputFormat!.json_schema.schema).toBe("object");
    // Verify key sub-schema properties
    const schema = tp!.outputFormat!.json_schema.schema as Record<string, unknown>;
    expect(schema.type).toBe("object");
    const props = schema.properties as Record<string, unknown>;
    expect(props.planName).toBeDefined();
    expect(props.steps).toBeDefined();
    expect((schema.required as string[]).sort()).toEqual(["planName", "steps"].sort());
  });

  it("bug_report has non-null outputFormat with expected fields", () => {
    const br = OUTPUT_SCHEMA_TEMPLATES.find((t) => t.id === "bug_report");
    expect(br).toBeDefined();
    expect(br!.outputFormat).not.toBeNull();
    const schema = br!.outputFormat!.json_schema.schema as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    const required = schema.required as string[];
    expect(props.title).toBeDefined();
    expect(props.severity).toBeDefined();
    expect(props.stepsToReproduce).toBeDefined();
    expect(props.expectedBehavior).toBeDefined();
    expect(props.actualBehavior).toBeDefined();
    expect(required).toContain("title");
    expect(required).toContain("severity");
    expect(required).toContain("stepsToReproduce");
    expect(required).toContain("expectedBehavior");
    expect(required).toContain("actualBehavior");
  });

  it("evidence_summary has non-null outputFormat with evidence array", () => {
    const es = OUTPUT_SCHEMA_TEMPLATES.find((t) => t.id === "evidence_summary");
    expect(es).toBeDefined();
    expect(es!.outputFormat).not.toBeNull();
    const schema = es!.outputFormat!.json_schema.schema as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    const required = schema.required as string[];
    expect(props.evidence).toBeDefined();
    expect(required).toContain("evidence");
  });

  it("custom template has null outputFormat", () => {
    const ct = OUTPUT_SCHEMA_TEMPLATES.find((t) => t.id === "custom");
    expect(ct).toBeDefined();
    expect(ct!.outputFormat).toBeNull();
  });

  it("OutputSchemaTemplate type is structurally correct for each entry", () => {
    for (const t of OUTPUT_SCHEMA_TEMPLATES) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.label).toBe("string");
      expect(typeof t.description).toBe("string");
      if (t.outputFormat === null) {
        expect(t.id).toBe("custom");
      } else {
        expect(t.outputFormat.type).toBe("json_schema");
        expect(typeof t.outputFormat.json_schema.name).toBe("string");
        expect(typeof t.outputFormat.json_schema.strict).toBe("boolean");
        expect(typeof t.outputFormat.json_schema.schema).toBe("object");
      }
    }
  });

  it("all non-null outputFormats have strict: true", () => {
    const nonNull = OUTPUT_SCHEMA_TEMPLATES.filter((t) => t.outputFormat !== null);
    expect(nonNull.length).toBeGreaterThan(0);
    for (const t of nonNull) {
      expect(t.outputFormat!.json_schema.strict).toBe(true);
    }
  });
});
