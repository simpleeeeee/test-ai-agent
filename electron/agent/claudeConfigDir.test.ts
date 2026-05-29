import { describe, expect, it } from "vitest";
import { resolveClaudeConfigDir } from "./claudeConfigDir.js";

describe("resolveClaudeConfigDir", () => {
  it("returns appDir/.claude when packaged", () => {
    expect(resolveClaudeConfigDir({ appDir: "D:/app", isPackaged: true }))
      .toBe("D:/app/.claude");
  });

  it("returns null when not packaged (dev mode)", () => {
    expect(resolveClaudeConfigDir({ appDir: "D:/repo", isPackaged: false }))
      .toBeNull();
  });

  it("normalizes trailing backslash from appDir", () => {
    expect(resolveClaudeConfigDir({ appDir: "D:/app/", isPackaged: true }))
      .toBe("D:/app/.claude");
  });

  it("normalizes trailing forward slash from appDir", () => {
    expect(resolveClaudeConfigDir({ appDir: "D:/app\\", isPackaged: true }))
      .toBe("D:/app/.claude");
  });

  it("returns null when appDir is empty and not packaged", () => {
    expect(resolveClaudeConfigDir({ appDir: "", isPackaged: false }))
      .toBeNull();
  });
});
