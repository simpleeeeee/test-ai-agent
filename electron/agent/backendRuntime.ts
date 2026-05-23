import type { MainToRendererChannel } from "../../src/ipc/channels";
import { AgentSessionManager } from "./agentSessionManager.js";

export type BackendRuntime = {
  emit: (channel: MainToRendererChannel, payload: unknown) => void;
  sessionManager: AgentSessionManager;
};

export function createBackendRuntime(input: {
  send: (channel: MainToRendererChannel, payload: unknown) => void;
}): BackendRuntime {
  const emit = (channel: MainToRendererChannel, payload: unknown) => {
    input.send(channel, payload);
  };
  return {
    emit,
    sessionManager: new AgentSessionManager({ emit }),
  };
}
