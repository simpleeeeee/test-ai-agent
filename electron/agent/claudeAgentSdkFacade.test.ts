import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("claudeAgentSdkFacade", () => {
  it("re-exports every public runtime export from the installed Claude Agent SDK", async () => {
    const realSdk = await import("@anthropic-ai/claude-agent-sdk");
    const facade = await import("./claudeAgentSdkFacade.js");

    const realKeys = Object.keys(realSdk).filter((key) => !key.startsWith("_")).sort();
    const facadeKeys = Object.keys(facade).sort();

    expect(facadeKeys).toEqual(expect.arrayContaining(realKeys));
    expect(typeof facade.query).toBe("function");
  });

  it("does not directly import the Anthropic Messages SDK in application source", () => {
    const root = process.cwd();
    const sourceRoots = ["electron", "src"];
    const violations: string[] = [];

    const scan = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
          continue;
        }
        if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) {
          continue;
        }
        if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
          continue;
        }
        const text = fs.readFileSync(fullPath, "utf8");
        if (text.includes("@anthropic-ai/sdk") || text.includes("new Anthropic(")) {
          violations.push(path.relative(root, fullPath));
        }
      }
    };

    sourceRoots.forEach((sourceRoot) => scan(path.join(root, sourceRoot)));

    expect(violations).toEqual([]);
  });
});
