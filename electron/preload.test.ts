import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { send: vi.fn() },
}));

import { contextBridge } from "electron";
import { createSafeIpcApi } from "./preload.js";

describe("createSafeIpcApi", () => {
  it("sends only allowlisted renderer channels", () => {
    const send = vi.fn();
    const api = createSafeIpcApi({ send });

    api.send("run:create", { prompt: "测试订单模块功能" });

    expect(send).toHaveBeenCalledWith("run:create", { prompt: "测试订单模块功能" });
    expect(() => api.send("shell:openExternal", {})).toThrow("Unsupported IPC channel");
  });
});

describe("preload module-level side effects", () => {
  it("exposes safe IPC API to renderer via contextBridge at module load", () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "aiTestAssistant",
      expect.objectContaining({
        send: expect.any(Function),
      })
    );
  });
});
