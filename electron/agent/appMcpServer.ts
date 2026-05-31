import { createSdkMcpServer } from "./claudeAgentSdkFacade.js";

export const appMcpServer = createSdkMcpServer({
  name: "ai-test-assistant",
  version: "0.1.0",
});
