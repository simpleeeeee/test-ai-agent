import { contextBridge, ipcRenderer } from "electron";
import {
  isMainToRendererChannel,
  isRendererToMainChannel,
  type MainToRendererChannel,
  type RendererToMainChannel,
} from "../src/ipc/channels.js";

type IpcSender = {
  send: (channel: string, payload: unknown) => void;
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
  on: (channel: string, listener: (event: unknown, payload: unknown) => void) => void;
  off: (channel: string, listener: (event: unknown, payload: unknown) => void) => void;
};

export function createSafeIpcApi(sender: IpcSender) {
  return {
    send(channel: string, payload: unknown) {
      if (!isRendererToMainChannel(channel)) {
        throw new Error("Unsupported IPC channel");
      }
      sender.send(channel, payload);
    },
    async invoke(channel: string, payload: unknown) {
      if (!isRendererToMainChannel(channel)) {
        throw new Error("Unsupported IPC channel");
      }
      return sender.invoke(channel, payload);
    },
    on(channel: string, listener: (payload: unknown) => void) {
      if (!isMainToRendererChannel(channel)) {
        throw new Error("Unsupported IPC channel");
      }
      const wrapped = (_event: unknown, payload: unknown) => listener(payload);
      sender.on(channel, wrapped);
      return () => sender.off(channel, wrapped);
    },
  };
}

declare global {
  interface Window {
    aiTestAssistant?: {
      send: (channel: RendererToMainChannel, payload: unknown) => void;
      invoke: (channel: RendererToMainChannel, payload: unknown) => Promise<unknown>;
      on: (channel: MainToRendererChannel, listener: (payload: unknown) => void) => () => void;
    };
  }
}

if (typeof contextBridge !== "undefined") {
  contextBridge.exposeInMainWorld("aiTestAssistant", createSafeIpcApi(ipcRenderer));
}
