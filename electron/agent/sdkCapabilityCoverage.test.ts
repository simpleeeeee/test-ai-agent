import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("SDK capability coverage", () => {
  it("keeps the facade as the only production import boundary for Claude Agent SDK", () => {
    const root = process.cwd();
    const imports: string[] = [];

    const scan = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
          continue;
        }
        if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
          continue;
        }
        const relative = path.relative(root, fullPath).replaceAll("\\", "/");
        const text = fs.readFileSync(fullPath, "utf8");
        if (text.includes("@anthropic-ai/claude-agent-sdk")) {
          imports.push(relative);
        }
      }
    };

    scan(path.join(root, "electron"));

    expect(imports).toEqual(["electron/agent/claudeAgentSdkFacade.ts"]);
  });

  it("covers the minimum SDK control methods required by the approved spec", () => {
    const adapterSource = fs.readFileSync(path.join(process.cwd(), "electron/agent/claudeAgentRuntimeAdapter.ts"), "utf8");
    const requiredMethods = [
      "close",
      "setModel",
      "setPermissionMode",
      "applyFlagSettings",
      "mcpServerStatus",
      "setMcpServers",
      "reconnectMcpServer",
      "toggleMcpServer",
      "supportedCommands",
      "supportedModels",
      "supportedAgents",
      "accountInfo",
      "initializationResult",
      "streamInput",
      "stopTask",
    ];

    expect(requiredMethods.filter((method) => !adapterSource.includes(`${method}:`))).toEqual([]);
  });

  it("requires every user-facing SDK capability to have renderer UI coverage", () => {
    const root = process.cwd();
    const files = [
      "src/app/backendBridge.ts",
      "src/app/components/ToolApprovalCard.tsx",
      "src/app/components/AskUserQuestionCard.tsx",
      "src/app/components/SdkControlDrawer.tsx",
      "src/app/components/McpStatusPanel.tsx",
      "src/app/components/MessageStream.tsx",
      "src/app/App.tsx",
    ];
    const combined = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
    const requiredUiTerms = [
      "approveTool",
      "denyTool",
      "answerQuestion",
      "setModel",
      "setPermissionMode",
      "applySettings",
      "supportedModels",
      "supportedCommands",
      "supportedAgents",
      "accountInfo",
      "initializationResult",
      "stopTask",
      "mcpStatus",
      "reconnectMcpServer",
      "toggleMcpServer",
      "listSessions",
      "resumeSession",
      "forkSession",
    ];

    expect(requiredUiTerms.filter((term) => !combined.includes(term))).toEqual([]);
  });
});
