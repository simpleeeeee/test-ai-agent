import type { AiTestAssistantApi } from "./backendBridge";

declare global {
  interface Window {
    aiTestAssistant?: AiTestAssistantApi;
  }
}

export {};
