import { describe, expect, it } from "vitest";
import { isRendererToMainChannel, rendererToMainChannels } from "./channels";

describe("IPC channels", () => {
  it("allows only explicit renderer-to-main channels", () => {
    expect(isRendererToMainChannel("run:create")).toBe(true);
    expect(isRendererToMainChannel("tool:approve")).toBe(true);
    expect(isRendererToMainChannel("shell:openExternal")).toBe(false);
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
