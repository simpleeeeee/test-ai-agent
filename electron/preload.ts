import { contextBridge, ipcRenderer } from "electron";
import { isRendererToMainChannel, type RendererToMainChannel } from "../src/ipc/channels.js";

type IpcSender = {
  send: (channel: string, payload: unknown) => void;
};

export function createSafeIpcApi(sender: IpcSender) {
  return {
    send(channel: string, payload: unknown) {
      if (!isRendererToMainChannel(channel)) {
        throw new Error("Unsupported IPC channel");
      }
      sender.send(channel, payload);
    },
  };
}

declare global {
  interface Window {
    aiTestAssistant?: {
      send: (channel: RendererToMainChannel, payload: unknown) => void;
    };
  }
}

if (typeof contextBridge !== "undefined") {
  contextBridge.exposeInMainWorld("aiTestAssistant", createSafeIpcApi(ipcRenderer));
}
