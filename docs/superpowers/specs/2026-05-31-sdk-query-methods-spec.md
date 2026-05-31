# Spec 2: Query 方法暴露 + 独立 SDK 函数适配

> **状态**: 设计已确认，待实现
> **日期**: 2026-05-31
> **前提**: 本项目仅使用中国大陆第三方 LLM API，不使用 Anthropic 官方 API
> **依赖**: Spec 1（SDK Options 补全与配置层改造）

## 一、概述

将 Claude Agent SDK（v0.3.150）Query 对象的 7 个未暴露方法、5 个独立 SDK 函数、1 个工具常量适配到项目中。涉及新增 9 个 IPC 通道（全部走 `ipcMain.handle` 请求/响应模式），需要严格遵循 IPC 通道同步约束。

## 二、影响文件

| 文件 | 改动类型 | 是否触发 IPC 同步 |
|------|---------|:---:|
| `electron/agent/claudeAgentRuntimeAdapter.ts` | 新增 7 个委托方法 | 否 |
| `electron/agent/agentSessionManager.ts` | 新增 7 个公开方法 + 2 个会话函数暴露 | 否 |
| `electron/agent/claudeAgentSdkFacade.ts` | 新增 4 个 re-export | 否 |
| `src/ipc/channels.ts` | `rendererToMainChannels` 追加 9 个通道 | **是** |
| `src/ipc/payloadSchemas.ts` | 新增 9 个 zod schema | **是** |
| `src/app/backendBridge.ts` | 新增 9 个 invoke 方法 | **是** |
| `electron/main.ts` | 注册 9 个 `handleRequest` + `startup()` 预热 | **是** |
| `electron/preload.ts` | 无需变更（invoke 模式自动覆盖） | 否 |
| `electron/preloadApi.ts` | 无需变更（invoke 模式自动覆盖） | 否 |

## 三、IPC 通道同步约束

> **强制规则**：凡涉及新增或修改 IPC 通道，以下文件必须同步更新，禁止漂移。

### 3.1 同步清单

| # | 文件 | 职责 | 本 spec 变更 |
|---|------|------|------------|
| 1 | `src/ipc/channels.ts` | 共享通道白名单 `rendererToMainChannels` | 追加 9 个通道 |
| 2 | `src/ipc/payloadSchemas.ts` | Zod 校验 schema | 新增 9 个 schema + 导出 |
| 3 | `src/app/backendBridge.ts` | 渲染进程侧 IPC 封装 | 新增 9 个 invoke 方法 |
| 4 | `electron/main.ts` | 主进程 IPC 注册 | 新增 9 个 `handleRequest` + `startup()` |
| 5 | `electron/preload.ts` | preload 入口 | 无需变更 |
| 6 | `electron/preloadApi.ts` | 安全暴露白名单 | 无需变更 |

> 说明：`preload.ts` 与 `preloadApi.ts` 仅在 `mainToRendererChannels`（push 通道）新增时才需更新。本 spec 全部走 `ipcMain.handle`（invoke 请求/响应），不涉及 push 通道。

### 3.2 强制验证步骤

每次修改后必须按顺序执行：

```bash
# 步骤 1：通道定义和 schema 一致性
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts

# 步骤 2：完整类型检查（渲染进程 + 主进程 + preload 三遍 tsc）
npm run build
```

两步骤全部通过后才能提交。

### 3.3 每个通道的同步链路

以 `run:get-context-usage` 为例，新增一个通道必须触碰 4 个文件：

```
① src/ipc/channels.ts
   rendererToMainChannels 追加 "run:get-context-usage"

② src/ipc/payloadSchemas.ts
   export const runGetContextUsagePayload = z.object({
     runId: z.string(),
   })

③ src/app/backendBridge.ts
   getContextUsage(runId: string) {
     return api.invoke("run:get-context-usage", { runId })
   }

④ electron/main.ts
   handleRequest("run:get-context-usage", ({ runId }) =>
     manager.getContextUsage(runId)
   )
```

## 四、新增 IPC 通道清单（9 个）

### 4.1 Query 对象方法（7 个）

| 通道名 | SDK 方法 | 输入 Schema | 输出类型 |
|--------|---------|------------|---------|
| `run:get-context-usage` | `Query.getContextUsage()` | `{ runId: z.string() }` | `Promise<SDKControlGetContextUsageResponse>` |
| `run:interrupt` | `Query.interrupt()` | `{ runId: z.string() }` | `Promise<void>` |
| `run:background-tasks` | `Query.backgroundTasks()` | `{ runId: z.string(), toolUseId: z.string().optional() }` | `Promise<boolean>` |
| `run:read-file` | `Query.readFile()` | `{ runId: z.string(), path: z.string(), maxBytes: z.number().optional(), encoding: z.enum(['utf-8','base64']).optional() }` | `Promise<SDKControlReadFileResponse \| null>` |
| `run:reload-plugins` | `Query.reloadPlugins()` | `{ runId: z.string() }` | `Promise<SDKControlReloadPluginsResponse>` |
| `run:rewind-files` | `Query.rewindFiles()` | `{ runId: z.string(), userMessageId: z.string(), dryRun: z.boolean().optional() }` | `Promise<RewindFilesResult>` |
| `run:seed-read-state` | `Query.seedReadState()` | `{ runId: z.string(), path: z.string(), mtime: z.number() }` | `Promise<void>` |

### 4.2 会话函数（2 个）

| 通道名 | SDK 函数 | 输入 Schema | 输出类型 |
|--------|---------|------------|---------|
| `run:get-subagent-messages` | `getSubagentMessages()` | `{ runId: z.string(), sessionId: z.string(), agentId: z.string(), limit: z.number().optional(), offset: z.number().optional() }` | `Promise<SessionMessage[]>` |
| `run:list-subagents` | `listSubagents()` | `{ runId: z.string(), sessionId: z.string() }` | `Promise<string[]>` |

## 五、不会新增 IPC 通道的适配项（6 个）

### 5.1 主进程启动预热 — `startup()`

**位置**: `electron/main.ts`，在 `app.whenReady()` 中，`createWindow()` 之前调用：

```typescript
import { startup } from "./agent/claudeAgentSdkFacade.js";

// 在 createWindow 之前调用，不阻塞启动流程
startup().then((warmQuery) => {
  // 预热完成，warmQuery.dispose() 可在应用退出时调用
  app.on("will-quit", () => { warmQuery.dispose(); });
}).catch((e) => {
  console.warn("SDK startup 预热失败:", e);
});
```

`startup()` 返回 `Promise<WarmQuery>`（实现了 `AsyncDisposable`），退出时调用 `dispose()` 释放资源。

### 5.2 `claudeAgentSdkFacade.ts` 纯导出（4 个）

```typescript
// 新增 re-export
export {
  createSdkMcpServer,               // 创建进程内 MCP 服务器
  tool,                             // 定义 SDK 工具
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,   // 提示词缓存边界标记
} from "@anthropic-ai/claude-agent-sdk";
```

| 导出 | 类型 | 用途 |
|------|------|------|
| `createSdkMcpServer` | 函数 | 在 SDK 进程中创建 MCP 服务器，返回 `McpSdkServerConfigWithInstance` |
| `tool` | 函数 | 定义 SDK 工具：`tool(name, description, schema, handler)` |
| `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` | 字符串常量 | 标记系统提示词中静态前缀和动态后缀的分界，用于跨会话 prompt 缓存 |

### 5.3 内部调用路径（2 个，不走 IPC）

`getSubagentMessages` 和 `listSubagents` 在主进程中直接调用 SDK，不走 IPC。但暴露 UI 时需 IPC（已列入 4.2）。

## 六、运行时层变更

### 6.1 `ClaudeAgentRuntimeAdapter` — RuntimeSession 扩展

在 `start()` 返回的运行时对象中新增 7 个方法，直接委托给 SDK `Query` 对象：

```typescript
// start() 返回的 RuntimeSession 类型扩展：
{
  // === 现有方法（不变）===
  close, setModel, setPermissionMode, applyFlagSettings,
  mcpServerStatus, setMcpServers, reconnectMcpServer, toggleMcpServer,
  supportedCommands, supportedModels, supportedAgents,
  accountInfo, initializationResult, streamInput, stopTask,

  // === 新增 7 个 ===
  getContextUsage(): Promise<SDKControlGetContextUsageResponse>;
  interrupt(): Promise<void>;
  backgroundTasks(toolUseId?: string): Promise<boolean>;
  readFile(path: string, options?: {
    maxBytes?: number;
    encoding?: 'utf-8' | 'base64';
  }): Promise<SDKControlReadFileResponse | null>;
  reloadPlugins(): Promise<SDKControlReloadPluginsResponse>;
  rewindFiles(userMessageId: string, options?: {
    dryRun?: boolean;
  }): Promise<RewindFilesResult>;
  seedReadState(path: string, mtime: number): Promise<void>;
}
```

实现方式：每个新增方法从 `this.sdk.query(...)` 返回的 `Query` 对象中解构出对应方法并委托。

### 6.2 `AgentSessionManager` 新增方法（9 个）

```typescript
// Query 方法委托（7 个）
getContextUsage(runId: string)   → this.session(runId).getContextUsage()
interrupt(runId: string)         → this.session(runId).interrupt()
backgroundTasks(runId: string, toolUseId?: string) → this.session(runId).backgroundTasks(toolUseId)
readFile(runId: string, path: string, options?: {...}) → this.session(runId).readFile(path, options)
reloadPlugins(runId: string)     → this.session(runId).reloadPlugins()
rewindFiles(runId: string, userMessageId: string, options?: {...}) → this.session(runId).rewindFiles(userMessageId, options)
seedReadState(runId: string, path: string, mtime: number) → this.session(runId).seedReadState(path, mtime)

// SDK 独立函数（2 个，不走 session）
getSubagentMessages(sessionId: string, agentId: string, options?: {...}) → sdkGetSubagentMessages(...)
listSubagents(sessionId: string) → sdkListSubagents(...)
```

### 6.3 `backendBridge.ts` 新增方法（9 个）

```typescript
getContextUsage(runId: string) {
  return api.invoke("run:get-context-usage", { runId });
}
interrupt(runId: string) {
  return api.invoke("run:interrupt", { runId });
}
backgroundTasks(runId: string, toolUseId?: string) {
  return api.invoke("run:background-tasks", { runId, toolUseId });
}
readFile(runId: string, path: string, options?: { maxBytes?: number; encoding?: 'utf-8' | 'base64' }) {
  return api.invoke("run:read-file", { runId, path, ...options });
}
reloadPlugins(runId: string) {
  return api.invoke("run:reload-plugins", { runId });
}
rewindFiles(runId: string, userMessageId: string, options?: { dryRun?: boolean }) {
  return api.invoke("run:rewind-files", { runId, userMessageId, ...options });
}
seedReadState(runId: string, path: string, mtime: number) {
  return api.invoke("run:seed-read-state", { runId, path, mtime });
}
getSubagentMessages(runId: string, sessionId: string, agentId: string, options?: { limit?: number; offset?: number }) {
  return api.invoke("run:get-subagent-messages", { runId, sessionId, agentId, ...options });
}
listSubagents(runId: string, sessionId: string) {
  return api.invoke("run:list-subagents", { runId, sessionId });
}
```

### 6.4 `electron/main.ts` IPC 注册

```typescript
// 在 registerBackendIpc() 中新增以下 handleRequest 调用：

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

## 七、错误处理

| 场景 | 处理方式 |
|------|---------|
| 调用时无活跃 run（runId 无效） | `agentSessionManager.run()` 抛 `Error("Unknown run: {id}")`，IPC handler 捕获后通过 `sendIpcError` 返回 |
| `interrupt()` 对已关闭会话 | SDK 内部静默忽略，不抛异常 |
| `backgroundTasks()` 无匹配 task | 返回 `false`（SDK 原生行为） |
| `readFile()` 权限拒绝 | 返回 `null`（SDK 原生行为） |
| `readFile()` 文件不存在 | 返回 `null` |
| `rewindFiles()` checkpoint 未启用 | 返回 `{ canRewind: false, error: "..." }` |
| `seedReadState()` 文件已变更 | SDK 静默跳过（不抛异常） |
| `startup()` 预热失败 | catch → `console.warn`，不阻塞应用启动 |
| `getSubagentMessages()` session 不存在 | 返回 `[]`（与 SDK 一致） |
| `listSubagents()` session 不存在 | 返回 `[]` |
| IPC payload schema 校验失败 | `parseRendererToMainPayload` 抛异常 → `sendIpcError` 返回 |
| `getContextUsage()` SDK 子进程不可用 | SDK 抛异常 → IPC handler 捕获 → `sendIpcError` |

## 八、测试策略

### 8.1 通道定义测试（`channels.test.ts`）

- 新增 9 个通道在 `rendererToMainChannels` 中且与现有通道不冲突
- 新增通道不在 `mainToRendererChannels` 中（invoke 模式不涉及 push）

### 8.2 Payload schema 测试（`payloadSchemas.test.ts`）

- 每个新通道的 schema：合法 payload 通过 `parse`，非法 payload 抛 `ZodError`
- `run:read-file`：`maxBytes` 为 number 通过，string 抛异常；`encoding` 合法值通过，非法值抛异常
- `run:rewind-files`：`dryRun` 为 boolean 通过，string 抛异常
- `run:background-tasks`：`toolUseId` 为 string/undefined 通过，number 抛异常
- `run:get-subagent-messages`：`limit`/`offset` 为 number/undefined 通过

### 8.3 Preload 测试（`preload.test.ts`）

- 确认 `preloadApi` 白名单不需要更新（invoke 模式）
- 确认上下文隔离未破坏

### 8.4 Adapter 测试（`claudeAgentRuntimeAdapter.test.ts`）

- Mock `Query` 对象，验证 7 个新方法正确委托
- `getContextUsage()` 返回 mock 数据正确透传
- `readFile()` 权限拒绝返回 null
- `rewindFiles()` dryRun 参数正确传递

### 8.5 SessionManager 测试（`agentSessionManager.test.ts`）

- 9 个新方法正确路由到 `ActiveRun` 或 SDK 函数
- `interrupt()` 与 `stopRun()` 行为区分：`interrupt` 不删除 run，`stopRun` 删除
- `getSubagentMessages()` 和 `listSubagents()` 不依赖 `ActiveRun`（直接调用 SDK）

### 8.6 构建验证（强制）

```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts
npm run build
```

## 九、不在范围内

- 不做 UI 层消费适配（`getContextUsage`、`readFile` 等方法的 UI 展示属于 Spec 3）
- 不暴露 `InMemorySessionStore`（用户排除）
- 不做 `connectRemoteControl`（依赖 Anthropic 基础设施）
- `startup()` 预热不做 UI 进度指示器
- 不新增 `mainToRendererChannels`（本 spec 全部走 invoke 请求/响应）
