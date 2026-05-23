import { describe, expect, it, vi } from "vitest";
import { createBackendRuntime } from "./backendRuntime.js";

describe("createBackendRuntime", () => {
  it("creates a session manager that emits through the provided sender", () => {
    const send = vi.fn();
    const runtime = createBackendRuntime({ send });

    expect(runtime.sessionManager).toBeDefined();
    expect(runtime.emit).toBeDefined();

    runtime.emit("sdk:error", { message: "错误", retryable: false });

    expect(send).toHaveBeenCalledWith("sdk:error", { message: "错误", retryable: false });
  });
});
