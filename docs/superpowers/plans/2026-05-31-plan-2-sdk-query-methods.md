# Plan 2: Query 方法暴露 + 独立 SDK 函数适配 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 暴露 SDK Query 对象的 7 个方法 + 5 个独立函数 + 1 个常量，新增 9 个 IPC 通道，预热主进程。

**Architecture:** 按数据流方向逐一适配——facade 导出 → Adapter 委托 → SessionManager 路由 → IPC 通道（channels + schemas + backendBridge + main.ts handle） → 构建验证。startup() 在 main.ts 启动时调用。

**Tech Stack:** TypeScript, Vitest, Zod, Electron IPC, @anthropic-ai/claude-agent-sdk v0.3.150

**IPC 约束:** 每个新通道必须同步 channels.ts + payloadSchemas.ts + backendBridge.ts + main.ts，preload.ts/preloadApi.ts 无需变更（invoke 模式）。

---

### Task 1: facade 新增 4 个导出

**Files:**
- Modify: `electron/agent/claudeAgentSdkFacade.ts`

- [ ] **Step 1: 新增导出**

```typescript
// electron/agent/claudeAgentSdkFacade.ts
export * from "@anthropic-ai/claude-agent-sdk";

// 已存在
export { foldSessionSummary } from "@anthropic-ai/claude-agent-sdk";

// === Plan 2 新增 ===
export {
  createSdkMcpServer,
  tool,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
} from "@anthropic-ai/claude-agent-sdk";
```

- [ ] **Step 2: 写验证测试**

```typescript
// claudeAgentSdkFacade.test.ts 新增
import { createSdkMcpServer, tool, SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from "./claudeAgentSdkFacade.js";

it("createSdkMcpServer is exported as a function", () => {
  expect(typeof createSdkMcpServer).toBe("function");
});

it("tool is exported as a function", () => {
  expect(typeof tool).toBe("function");
});

it("SYSTEM_PROMPT_DYNAMIC_BOUNDARY is a string", () => {
  expect(typeof SYSTEM_PROMPT_DYNAMIC_BOUNDARY).toBe("string");
});
```

- [ ] **Step 3: 运行测试**

```bash
npm test -- electron/agent/claudeAgentSdkFacade.test.ts
```

- [ ] **Step 4: 提交**

```bash
git add electron/agent/claudeAgentSdkFacade.ts electron/agent/claudeAgentSdkFacade.test.ts
git commit -m "feat: facade 导出 createSdkMcpServer, tool, SYSTEM_PROMPT_DYNAMIC_BOUNDARY"
```

---

### Task 2: ClaudeAgentRuntimeAdapter 新增 7 个 Query 方法

**Files:**
- Modify: `electron/agent/claudeAgentRuntimeAdapter.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// claudeAgentRuntimeAdapter.test.ts 新增
it("exposes getContextUsage on returned session", async () => {
  const mockQuery = {
    getContextUsage: vi.fn().mockResolvedValue({ total_tokens: 1000 }),
  };
  const mockSdk = { query: vi.fn().mockReturnValue(mockQuery) };
  const adapter = new ClaudeAgentRuntimeAdapter(mockSdk as any);
  const session = adapter.start({ prompt: "test", options: {}, canUseTool: async () => ({ behavior: "allow" as const }) });
  expect(session.getContextUsage).toBeDefined();
  const result = await session.getContextUsage();
  expect(result).toEqual({ total_tokens: 1000 });
});

it("exposes interrupt on returned session", () => {
  const mockQuery = { interrupt: vi.fn().mockResolvedValue(undefined) };
  const mockSdk = { query: vi.fn().mockReturnValue(mockQuery) };
  const adapter = new ClaudeAgentRuntimeAdapter(mockSdk as any);
  const session = adapter.start({ prompt: "test", options: {}, canUseTool: async () => ({ behavior: "allow" as const }) });
  expect(session.interrupt).toBeDefined();
});

it("exposes backgroundTasks, readFile, reloadPlugins, rewindFiles, seedReadState", () => {
  const mockQuery = {
    backgroundTasks: vi.fn(),
    readFile: vi.fn(),
    reloadPlugins: vi.fn(),
    rewindFiles: vi.fn(),
    seedReadState: vi.fn(),
  };
  const mockSdk = { query: vi.fn().mockReturnValue(mockQuery) };
  const adapter = new ClaudeAgentRuntimeAdapter(mockSdk as any);
  const session = adapter.start({ prompt: "test", options: {}, canUseTool: async () => ({ behavior: "allow" as const }) });
  expect(session.backgroundTasks).toBeDefined();
  expect(session.readFile).toBeDefined();
  expect(session.reloadPlugins).toBeDefined();
  expect(session.rewindFiles).toBeDefined();
  expect(session.seedReadState).toBeDefined();
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/claudeAgentRuntimeAdapter.test.ts
```

- [ ] **Step 3: 实现 7 个方法委托**

```typescript
// claudeAgentRuntimeAdapter.ts — start() 返回的 RuntimeSession 对象中新增

return {
  messages: queryResult as AsyncIterable<unknown>,
  close: () => queryResult.close(),
  setModel: (model: string) => queryResult.setModel(model),
  setPermissionMode: (mode: string) => queryResult.setPermissionMode(mode),
  applyFlagSettings: (settings: Record<string, unknown>) => queryResult.applyFlagSettings(settings),
  mcpServerStatus: () => queryResult.mcpServerStatus(),
  setMcpServers: (servers: Record<string, unknown>) => queryResult.setMcpServers(servers),
  reconnectMcpServer: (serverName: string) => queryResult.reconnectMcpServer(serverName),
  toggleMcpServer: (serverName: string, enabled: boolean) => queryResult.toggleMcpServer(serverName, enabled),
  supportedCommands: () => queryResult.supportedCommands(),
  supportedModels: () => queryResult.supportedModels(),
  supportedAgents: () => queryResult.supportedAgents(),
  accountInfo: () => queryResult.accountInfo(),
  initializationResult: () => queryResult.initializationResult(),
  streamInput: (message: unknown) => {
    async function* once() { yield message; }
    return queryResult.streamInput(once() as any);
  },
  stopTask: (taskId: string) => queryResult.stopTask(taskId),

  // === Plan 2 新增 ===
  getContextUsage: () => (queryResult as any).getContextUsage(),
  interrupt: () => (queryResult as any).interrupt(),
  backgroundTasks: (toolUseId?: string) => (queryResult as any).backgroundTasks(toolUseId),
  readFile: (path: string, options?: { maxBytes?: number; encoding?: "utf-8" | "base64" }) =>
    (queryResult as any).readFile(path, options),
  reloadPlugins: () => (queryResult as any).reloadPlugins(),
  rewindFiles: (userMessageId: string, options?: { dryRun?: boolean }) =>
    (queryResult as any).rewindFiles(userMessageId, options),
  seedReadState: (path: string, mtime: number) =>
    (queryResult as any).seedReadState(path, mtime),
};
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/claudeAgentRuntimeAdapter.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/claudeAgentRuntimeAdapter.ts electron/agent/claudeAgentRuntimeAdapter.test.ts
git commit -m "feat: RuntimeAdapter 暴露 7 个 Query 方法"
```

---

### Task 3: AgentSessionManager 新增 9 个方法

**Files:**
- Modify: `electron/agent/agentSessionManager.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// agentSessionManager.test.ts 新增
it("getContextUsage delegates to session", async () => {
  const mockSession = { getContextUsage: vi.fn().mockResolvedValue({ total_tokens: 500 }) };
  const manager = createTestManager({ mockSession });
  manager.runsForTest.set("run-1", { session: mockSession } as any);
  await manager.getContextUsage("run-1");
  expect(mockSession.getContextUsage).toHaveBeenCalled();
});

it("interrupt delegates to session", async () => {
  const mockSession = { interrupt: vi.fn().mockResolvedValue(undefined) };
  const manager = createTestManager({ mockSession });
  manager.runsForTest.set("run-1", { session: mockSession } as any);
  await manager.interrupt("run-1");
  expect(mockSession.interrupt).toHaveBeenCalled();
});

it("backgroundTasks delegates with optional toolUseId", async () => {
  const mockSession = { backgroundTasks: vi.fn().mockResolvedValue(true) };
  const manager = createTestManager({ mockSession });
  manager.runsForTest.set("run-1", { session: mockSession } as any);
  await manager.backgroundTasks("run-1", "tool-123");
  expect(mockSession.backgroundTasks).toHaveBeenCalledWith("tool-123");
});

it("throws for unknown runId", () => {
  const manager = createTestManager({});
  expect(() => manager.getContextUsage("unknown-run")).toThrow("Unknown run");
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/agentSessionManager.test.ts
```

- [ ] **Step 3: 实现 9 个方法**

```typescript
// agentSessionManager.ts — 新增方法

// === Query 方法委托（7 个）===
getContextUsage(runId: string) {
  return this.session(runId).getContextUsage();
}
interrupt(runId: string) {
  return this.session(runId).interrupt();
}
backgroundTasks(runId: string, toolUseId?: string) {
  return this.session(runId).backgroundTasks(toolUseId);
}
readFile(runId: string, path: string, options?: { maxBytes?: number; encoding?: "utf-8" | "base64" }) {
  return this.session(runId).readFile(path, options);
}
reloadPlugins(runId: string) {
  return this.session(runId).reloadPlugins();
}
rewindFiles(runId: string, userMessageId: string, options?: { dryRun?: boolean }) {
  return this.session(runId).rewindFiles(userMessageId, options);
}
seedReadState(runId: string, path: string, mtime: number) {
  return this.session(runId).seedReadState(path, mtime);
}

// === SDK 独立函数（2 个）===
async getSubagentMessages(sessionId: string, agentId: string, options?: { limit?: number; offset?: number }) {
  return sdkGetSubagentMessages(sessionId, agentId, {
    dir: this.resolveDir(),
    ...options,
  });
}
async listSubagents(sessionId: string) {
  return sdkListSubagents(sessionId, { dir: this.resolveDir() });
}
```

`getSubagentMessages` 和 `listSubagents` 需要从 facade 导入：

```typescript
import {
  // ... 现有导入 ...
  getSubagentMessages as sdkGetSubagentMessages,
  listSubagents as sdkListSubagents,
} from "./claudeAgentSdkFacade.js";
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/agentSessionManager.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/agentSessionManager.ts electron/agent/agentSessionManager.test.ts
git commit -m "feat: AgentSessionManager 新增 9 个方法"
```

---

### Task 4: 新增 9 个 IPC 通道 — channels.ts + payloadSchemas.ts

**Files:**
- Modify: `src/ipc/channels.ts`
- Modify: `src/ipc/payloadSchemas.ts`

- [ ] **Step 1: channels.ts 追加 9 个通道**

```typescript
// src/ipc/channels.ts — rendererToMainChannels 数组追加
export const rendererToMainChannels = [
  // ... 现有通道 ...
  "run:get-context-usage",
  "run:interrupt",
  "run:background-tasks",
  "run:read-file",
  "run:reload-plugins",
  "run:rewind-files",
  "run:seed-read-state",
  "run:get-subagent-messages",
  "run:list-subagents",
] as const;
```

- [ ] **Step 2: payloadSchemas.ts 新增 9 个 schema**

```typescript
// src/ipc/payloadSchemas.ts 新增
import { z } from "zod";

export const runGetContextUsagePayload = z.object({
  runId: z.string(),
});

export const runInterruptPayload = z.object({
  runId: z.string(),
});

export const runBackgroundTasksPayload = z.object({
  runId: z.string(),
  toolUseId: z.string().optional(),
});

export const runReadFilePayload = z.object({
  runId: z.string(),
  path: z.string(),
  maxBytes: z.number().optional(),
  encoding: z.enum(["utf-8", "base64"]).optional(),
});

export const runReloadPluginsPayload = z.object({
  runId: z.string(),
});

export const runRewindFilesPayload = z.object({
  runId: z.string(),
  userMessageId: z.string(),
  dryRun: z.boolean().optional(),
});

export const runSeedReadStatePayload = z.object({
  runId: z.string(),
  path: z.string(),
  mtime: z.number(),
});

export const runGetSubagentMessagesPayload = z.object({
  runId: z.string(),
  sessionId: z.string(),
  agentId: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export const runListSubagentsPayload = z.object({
  runId: z.string(),
  sessionId: z.string(),
});
```

并更新 `parseRendererToMainPayload` 函数的 switch/map 添加新通道的 schema 映射。

- [ ] **Step 3: 写测试**

```typescript
// payloadSchemas.test.ts 新增
describe("new invoke channels", () => {
  it("runGetContextUsagePayload accepts valid input", () => {
    expect(() => runGetContextUsagePayload.parse({ runId: "r1" })).not.toThrow();
  });
  it("runReadFilePayload optional fields", () => {
    expect(() => runReadFilePayload.parse({ runId: "r1", path: "/tmp/test" })).not.toThrow();
    expect(() => runReadFilePayload.parse({ runId: "r1", path: "/tmp/test", maxBytes: 1024, encoding: "base64" })).not.toThrow();
    expect(() => runReadFilePayload.parse({ runId: "r1", path: "/tmp/test", encoding: "invalid" })).toThrow();
  });
  it("runBackgroundTasksPayload toolUseId is optional", () => {
    expect(() => runBackgroundTasksPayload.parse({ runId: "r1" })).not.toThrow();
    expect(() => runBackgroundTasksPayload.parse({ runId: "r1", toolUseId: "t1" })).not.toThrow();
  });
  // ... 其余 schema 测试 ...
});
```

- [ ] **Step 4: 运行通道和 schema 测试**

```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/ipc/channels.ts src/ipc/payloadSchemas.ts src/ipc/payloadSchemas.test.ts
git commit -m "feat: 新增 9 个 IPC 通道定义和 zod schema"
```

---

### Task 5: backendBridge.ts 新增 9 个 invoke 方法

**Files:**
- Modify: `src/app/backendBridge.ts`

- [ ] **Step 1: 实现方法**

```typescript
// backendBridge.ts — createBackendBridge 返回对象中新增

getContextUsage(runId: string) {
  return api.invoke("run:get-context-usage", { runId });
},
interrupt(runId: string) {
  return api.invoke("run:interrupt", { runId });
},
backgroundTasks(runId: string, toolUseId?: string) {
  return api.invoke("run:background-tasks", { runId, toolUseId });
},
readFile(runId: string, path: string, options?: { maxBytes?: number; encoding?: "utf-8" | "base64" }) {
  return api.invoke("run:read-file", { runId, path, ...options });
},
reloadPlugins(runId: string) {
  return api.invoke("run:reload-plugins", { runId });
},
rewindFiles(runId: string, userMessageId: string, options?: { dryRun?: boolean }) {
  return api.invoke("run:rewind-files", { runId, userMessageId, ...options });
},
seedReadState(runId: string, path: string, mtime: number) {
  return api.invoke("run:seed-read-state", { runId, path, mtime });
},
getSubagentMessages(runId: string, sessionId: string, agentId: string, options?: { limit?: number; offset?: number }) {
  return api.invoke("run:get-subagent-messages", { runId, sessionId, agentId, ...options });
},
listSubagents(runId: string, sessionId: string) {
  return api.invoke("run:list-subagents", { runId, sessionId });
},
```

- [ ] **Step 2: 更新 BackendBridge 类型**

```typescript
export type BackendBridge = ReturnType<typeof createBackendBridge>;
// 自动推断新方法，无需手动修改
```

- [ ] **Step 3: 运行 tsc 检查**

```bash
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add src/app/backendBridge.ts
git commit -m "feat: backendBridge 新增 9 个 invoke 方法"
```

---

### Task 6: electron/main.ts 注册 9 个 handleRequest

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: 添加 handleRequest 注册**

```typescript
// electron/main.ts — registerBackendIpc 函数中，现有 handleRequest 调用组之后追加

handleRequest("run:get-context-usage", ({ runId }) =>
  manager.getContextUsage(runId));

handleRequest("run:interrupt", ({ runId }) =>
  manager.interrupt(runId));

handleRequest("run:background-tasks", ({ runId, toolUseId }) =>
  manager.backgroundTasks(runId, toolUseId));

handleRequest("run:read-file", ({ runId, path, maxBytes, encoding }) =>
  manager.readFile(runId, path, { maxBytes, encoding }));

handleRequest("run:reload-plugins", ({ runId }) =>
  manager.reloadPlugins(runId));

handleRequest("run:rewind-files", ({ runId, userMessageId, dryRun }) =>
  manager.rewindFiles(runId, userMessageId, { dryRun }));

handleRequest("run:seed-read-state", ({ runId, path, mtime }) =>
  manager.seedReadState(runId, path, mtime));

handleRequest("run:get-subagent-messages", ({ runId, sessionId, agentId, limit, offset }) =>
  manager.getSubagentMessages(sessionId, agentId, { limit, offset }));

handleRequest("run:list-subagents", ({ runId, sessionId }) =>
  manager.listSubagents(sessionId));
```

- [ ] **Step 2: tsc 检查主进程**

```bash
npx tsc -p tsconfig.node.json --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add electron/main.ts
git commit -m "feat: main.ts 注册 9 个新 IPC handler"
```

---

### Task 7: startup() 预热 main.ts

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: 实现**

```typescript
// electron/main.ts — 在文件顶部导入
import { startup } from "./agent/claudeAgentSdkFacade.js";

// app.whenReady() 中，createWindow() 之前
async function createWindow() {
  // ... 现有代码 ...

  // 非阻塞预热
  startup().then((warmQuery) => {
    app.on("will-quit", () => { warmQuery.dispose(); });
  }).catch((e) => {
    console.warn("SDK startup 预热失败:", e);
  });

  // ... 创建 window ...
}
```

- [ ] **Step 2: tsc 检查**

```bash
npx tsc -p tsconfig.node.json --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add electron/main.ts
git commit -m "feat: main.ts 启动时调用 startup() 预热 SDK"
```

---

### Task 8: 强制 IPC 同步验证

- [ ] **Step 1: 通道定义和 schema 测试**

```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts
```

预期：全部 PASS。

- [ ] **Step 2: 完整构建**

```bash
npm run build
```

预期：`tsc -p tsconfig.json && tsc -p tsconfig.node.json && tsc -p tsconfig.preload.json && vite build` 全部通过。

- [ ] **Step 3: 运行全部相关测试**

```bash
npm test -- electron/agent/claudeAgentRuntimeAdapter.test.ts electron/agent/agentSessionManager.test.ts electron/agent/claudeAgentSdkFacade.test.ts
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: Plan 2 最终验证通过 — 9 IPC 通道全部同步"
```

---

## 验证 Checklist

- [ ] 9 个通道在 `rendererToMainChannels` 中
- [ ] 9 个通道在 `payloadSchemas.ts` 中有对应的 zod schema
- [ ] 9 个方法在 `backendBridge.ts` 中正确实现
- [ ] 9 个 `handleRequest` 在 `main.ts` 中注册
- [ ] `npm run build` 三遍 tsc 通过
- [ ] `npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts` 通过
- [ ] `preload.ts` 和 `preloadApi.ts` 无需修改（invoke 模式自动覆盖）
