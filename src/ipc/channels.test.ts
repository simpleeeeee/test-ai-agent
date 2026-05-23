import { describe, expect, it } from "vitest";
import { isRendererToMainChannel, isMainToRendererChannel, rendererToMainChannels } from "./channels";

describe("IPC channels", () => {
  it("allows only explicit renderer-to-main channels", () => {
    expect(isRendererToMainChannel("run:create")).toBe(true);
    expect(isRendererToMainChannel("tool:approve")).toBe(true);
    expect(isRendererToMainChannel("shell:openExternal")).toBe(false);
  });

  it("allows only explicit main-to-renderer channels", () => {
    expect(isMainToRendererChannel("run:planning")).toBe(true);
    expect(isMainToRendererChannel("evidence:created")).toBe(true);
    expect(isMainToRendererChannel("shell:openExternal")).toBe(false);
  });

  it("rejects malformed or empty channel names", () => {
    expect(isRendererToMainChannel("")).toBe(false);
    expect(isRendererToMainChannel("random-string")).toBe(false);
  });

  it("contains the spec-defined renderer-to-main actions", () => {
    expect(rendererToMainChannels).toEqual([
      "run:create",
      "run:approve-plan",
      "run:revise-plan",
      "tool:approve",
      "tool:deny",
      "run:stop",
    ]);
  });
});
