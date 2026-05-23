import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

import { contextBridge } from "electron";
import { createSafeIpcApi } from "./preload.js";

describe("createSafeIpcApi", () => {
  it("sends only allowlisted renderer channels", () => {
    const sender = { send: vi.fn(), invoke: vi.fn(), on: vi.fn(), off: vi.fn() };
    const api = createSafeIpcApi(sender);

    api.send("run:create", { prompt: "测试订单模块功能" });

    expect(sender.send).toHaveBeenCalledWith("run:create", { prompt: "测试订单模块功能" });
    expect(() => api.send("shell:openExternal", {})).toThrow("Unsupported IPC channel");
  });

  it("invokes only allowlisted renderer channels", async () => {
    const sender = { send: vi.fn(), invoke: vi.fn().mockResolvedValue(["model-a"]), on: vi.fn(), off: vi.fn() };
    const api = createSafeIpcApi(sender);

    await expect(api.invoke("sdk:supported-models", { runId: "run-1" })).resolves.toEqual(["model-a"]);
    expect(sender.invoke).toHaveBeenCalledWith("sdk:supported-models", { runId: "run-1" });
    await expect(api.invoke("shell:openExternal", {})).rejects.toThrow("Unsupported IPC channel");
  });

  it("subscribes only to allowlisted main channels and returns an unsubscribe function", () => {
    const sender = { send: vi.fn(), invoke: vi.fn(), on: vi.fn(), off: vi.fn() };
    const api = createSafeIpcApi(sender);
    const listener = vi.fn();

    const unsubscribe = api.on("assistant:text-delta", listener);
    const wrapped = sender.on.mock.calls[0][1];
    wrapped({}, { delta: "文本" });
    unsubscribe();

    expect(listener).toHaveBeenCalledWith({ delta: "文本" });
    expect(sender.off).toHaveBeenCalledWith("assistant:text-delta", wrapped);
    expect(() => api.on("shell:openExternal", listener)).toThrow("Unsupported IPC channel");
  });
});

describe("preload module-level side effects", () => {
  it("exposes safe IPC API to renderer via contextBridge at module load", () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "aiTestAssistant",
      expect.objectContaining({
        send: expect.any(Function),
        invoke: expect.any(Function),
        on: expect.any(Function),
      }),
    );
  });
});
