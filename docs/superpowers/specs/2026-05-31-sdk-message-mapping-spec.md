# Spec 3: SDK 消息类型映射补全

> **状态**: 设计已确认，待实现
> **日期**: 2026-05-31
> **前提**: 本项目仅使用中国大陆第三方 LLM API，不使用 Anthropic 官方 API
> **依赖**: 无强依赖（独立于 Spec 1、Spec 2）

## 一、概述

Claude Agent SDK 子进程产出 ~30 种消息类型，当前 `runEventMapper.ts` 映射了约 12 种核心类型（流式消息、result、部分 system 消息），还有 20 种未映射（排除 `SDKPromptSuggestionMessage`，它依赖 Anthropic 建议模型，第三方 API 不会产出）。

本 spec 将这 20 种消息全部映射为结构化 `RunEvent`，采用**细粒度**策略——每种消息对应一个独立 RunEvent 类型。

## 二、影响文件

| 文件 | 改动类型 |
|------|---------|
| `src/domain/testRun.ts` | 新增 14 个 RunEvent 类型 + 3 个扩充 + `applyRunEvent` 透传 |
| `electron/agent/runEventMapper.ts` | `mapSdkMessageWithSession()` 新增 4 种 + `mapNonStreamSdkMessage()` 新增 16 种 |
| `src/app/sdkUiTypes.ts` | 新增 5 个 UI 状态字段 |
| `src/app/sdkEventStore.ts` | 新增 7 个 reducer case |
| `electron/agent/runEventMapper.test.ts` | 新增消息映射测试 |
| `src/domain/testRun.test.ts` | 新增 RunEvent 类型透传测试 |
| `src/app/sdkEventStore.test.ts` | 新增 reducer case 测试 |

> **不涉及 IPC 通道变更**。新增的 RunEvent 走现有 `mainToRendererChannels` 中的事件通道（`sdk:raw-message` 已覆盖所有 `sdk:*` 前缀通道），`runEventMapper` 在主进程中运行，通过 `emitRunEvent` 经现有 IPC push 到渲染进程。

## 三、RunEvent 类型扩展

### 3.1 新增类型（14 个）

`RunEvent` 联合类型追加以下成员：

| # | 类型 | 字段 | 来源 |
|---|------|------|------|
| 1 | `sdk:tool-progress` | `toolUseId: string; status: string; progress?: unknown` | `SDKToolProgressMessage` |
| 2 | `sdk:tool-summary` | `toolUseId: string; summary: string` | `SDKToolUseSummaryMessage` |
| 3 | `sdk:task-notification` | `taskId: string; status: string; description?: string` | `SDKTaskNotificationMessage` |
| 4 | `sdk:notification` | `message: string; title?: string; notificationType: string` | `SDKNotificationMessage` |
| 5 | `sdk:local-command-output` | `command: string; output: string` | `SDKLocalCommandOutputMessage` |
| 6 | `sdk:plugin-install` | `pluginName: string; status: string` | `SDKPluginInstallMessage` |
| 7 | `sdk:rate-limit` | `info: unknown` | `SDKRateLimitEvent` |
| 8 | `sdk:files-persisted` | `files: string[]; totalBytes?: number` | `SDKFilesPersistedEvent` |
| 9 | `sdk:memory-recall` | `memories: unknown[]` | `SDKMemoryRecallMessage` |
| 10 | `sdk:mirror-error` | `message: string` | `SDKMirrorErrorMessage` |
| 11 | `sdk:elicitation-complete` | `serverName: string; elicitationId?: string` | `SDKElicitationCompleteMessage` |
| 12 | `sdk:user-message-replay` | `messageId: string; content: string` | `SDKUserMessageReplay` |
| 13 | `sdk:compact-boundary` | `direction: 'pre' \| 'post'` | `SDKCompactBoundaryMessage` |
| 14 | `sdk:deferred-tool-use` | `toolName: string; toolUseId: string` | `SDKDeferredToolUse` |

### 3.2 扩充已有类型（3 个）

| 已有类型 | 新增字段 | 来源 |
|---------|---------|------|
| `sdk:task-progress` | `status?: string`（已有 `taskId`、`summary`） | `SDKTaskStartedMessage`、`SDKTaskUpdatedMessage` |
| `sdk:hook-event` | `stage?: string`（`started` / `progress` / `response`） | `SDKHookStartedMessage`、`SDKHookProgressMessage`、`SDKHookResponseMessage` |
| `sdk:session-changed` | `state?: string`（`active` / `idle` / `closed`） | `SDKSessionStateChangedMessage` |

### 3.3 `applyRunEvent` 处理

所有新事件在领域 reducer 中**透传**，不修改 `TestRun` 核心状态（它们是 UI 层事件，与测试运行领域状态无关）：

```typescript
// 全部归入已有的透传分支，与 sdk:raw-message、sdk:system-event 等一致
case "sdk:tool-progress":
case "sdk:tool-summary":
case "sdk:task-notification":
case "sdk:notification":
case "sdk:local-command-output":
case "sdk:plugin-install":
case "sdk:rate-limit":
case "sdk:files-persisted":
case "sdk:memory-recall":
case "sdk:mirror-error":
case "sdk:elicitation-complete":
case "sdk:user-message-replay":
case "sdk:compact-boundary":
case "sdk:deferred-tool-use":
  return run;
```

## 四、runEventMapper 变更

### 4.1 `mapSdkMessageWithSession()` — 新增 stream_event 处理（4 种）

在现有 `sdkEvent?.type` 匹配链中追加：

```typescript
// tool_progress — 工具执行进度（如 Bash 命令实时输出）
if (sdkEvent?.type === "tool_progress") {
  events.push({
    type: "sdk:tool-progress",
    toolUseId: sdkEvent.tool_use_id ?? "",
    status: sdkEvent.status ?? "running",
    ...(sdkEvent.progress ? { progress: sdkEvent.progress } : {}),
  });
}

// tool_summary — 工具调用完成后的摘要
if (sdkEvent?.type === "tool_summary") {
  events.push({
    type: "sdk:tool-summary",
    toolUseId: sdkEvent.tool_use_id ?? "",
    summary: sdkEvent.summary ?? "",
  });
}

// task_started — 子代理或后台任务启动
if (sdkEvent?.type === "task_started") {
  events.push({
    type: "sdk:task-progress",
    taskId: sdkEvent.task_id ?? "",
    status: "started",
    ...(sdkEvent.summary ? { summary: sdkEvent.summary } : {}),
  });
}

// task_updated — 任务状态更新
if (sdkEvent?.type === "task_updated") {
  events.push({
    type: "sdk:task-progress",
    taskId: sdkEvent.task_id ?? "",
    status: "updated",
    ...(sdkEvent.summary ? { summary: sdkEvent.summary } : {}),
  });
}
```

### 4.2 `mapNonStreamSdkMessage()` — 新增 system 消息处理（16 种）

在现有 `message.type === "system"` 分支中追加 subtype 匹配：

| subtype | 映射为 | 字段映射 |
|---------|--------|---------|
| `task_notification` | `sdk:task-notification` | `task_id→taskId`, `status`, `description` |
| `notification` | `sdk:notification` | `message`, `title`, `notification_type→notificationType` |
| `hook_started` | `sdk:hook-event` | `hook_name→hookName`, `stage: "started"` |
| `hook_progress` | `sdk:hook-event` | `hook_name→hookName`, `stage: "progress"` |
| `hook_response` | `sdk:hook-event` | `hook_name→hookName`, `stage: "response"` |
| `local_command_output` | `sdk:local-command-output` | `command`, `output` |
| `plugin_install` | `sdk:plugin-install` | `plugin_name→pluginName`, `status` |
| `rate_limit` | `sdk:rate-limit` | `rate_limit_info→info` |
| `files_persisted` | `sdk:files-persisted` | `files`, `total_bytes→totalBytes` |
| `memory_recall` | `sdk:memory-recall` | `memories` |
| `session_state_changed` | `sdk:session-changed` | `session_id→sessionId` + `state` |
| `mirror_error` | `sdk:mirror-error` | `message` |
| `elicitation_complete` | `sdk:elicitation-complete` | `mcp_server_name→serverName`, `elicitation_id→elicitationId` |
| `user_message_replay` | `sdk:user-message-replay` | `uuid→messageId`, `message→content` |
| `compact_boundary` | `sdk:compact-boundary` | `direction` |
| `deferred_tool_use` | `sdk:deferred-tool-use` | `tool_name→toolName`, `tool_use_id→toolUseId` |

### 4.3 raw 消息保留

每种映射后 `events.push(...)` 追加到数组，与现有的 `events.push(raw(runId, message))` 并存。结构化事件是 raw 消息的**补充**而非替代，确保 UI 始终能访问原始数据。

## 五、UI 状态层变更

### 5.1 `sdkUiTypes.ts` 新增字段

| 字段 | 类型 | 默认值 | 用途 |
|------|------|--------|------|
| `toolProgress` | `Map<string, { toolUseId: string; status: string; progress?: unknown }>` | `new Map()` | 工具执行进度 |
| `taskNotifications` | `Array<{ taskId: string; status: string; description?: string }>` | `[]` | 后台任务完成/失败通知 |
| `notifications` | `Array<{ message: string; title?: string; notificationType: string }>` | `[]` | 系统通知消息 |
| `rateLimitInfo` | `unknown \| undefined` | `undefined` | 速率限制状态信息 |
| `mirrorErrors` | `Array<{ message: string }>` | `[]` | SessionStore 镜像写入错误 |

> `createInitialSdkUiState()` 同步更新默认值。

### 5.2 `sdkEventStore.ts` reducer 新增 case

| 事件通道 | 处理逻辑 |
|---------|---------|
| `sdk:tool-progress` | `toolProgress.set(payload.toolUseId, { ... })`，覆盖旧值 |
| `sdk:task-notification` | 追加到 `taskNotifications`（截断 200 条上限） |
| `sdk:notification` | 追加到 `notifications`（截断 200 条上限） |
| `sdk:rate-limit` | `rateLimitInfo = payload.info`（覆盖） |
| `sdk:mirror-error` | 追加到 `mirrorErrors`（截断 200 条上限） |

| 事件通道 | 扩充逻辑 |
|---------|---------|
| `sdk:session-changed` | 如果 payload 含 `state` 字段，追加 state 到 session 数据 |
| `sdk:hook-event` | 如果 payload 含 `stage` 字段，按 stage 分发到对应 UI 状态 |

其余 13 个事件在 `sdkEventStore.ts` 中**无 reducer 处理**——它们通过 `sdk:raw-message` 通道自动进入 `rawMessages` 数组，UI 可按需读取，无需额外存储。

### 5.3 200 条上限

所有新增数组字段沿用现有截断策略：`>= 200` 时 `slice(-199)` 后追加新条目。

## 六、UI 层展示设计

新增的 20 种事件按用户可见性分为三级。

### 6.1 一级：需要独立 UI 控件（3 种）

| 事件 | 展示位置 | 控件类型 | 说明 |
|------|---------|---------|------|
| `sdk:rate-limit` | `MessageStream` 消息流顶部 | 警告横幅（黄色背景 + 图标） | 速率限制直接影响用户操作，必须醒目 |
| `sdk:notification` | `MessageStream` 消息流中 | 系统消息气泡（灰色小字，与用户/助手消息区分） | 如"正在压缩上下文"等系统通知 |
| `sdk:task-notification` | `TestConsole` 任务区 | 任务状态更新条目 | 后台任务完成/失败，延续现有任务展示模式 |

### 6.2 二级：扩充现有控件（2 种）

| 事件 | 展示位置 | 改动内容 |
|------|---------|---------|
| `sdk:task-progress`（扩充 `status` 字段） | `TestConsole` 任务区 | 在现有 `summary` 外增加状态标签（`started` / `updated`） |
| `sdk:tool-progress` | `ToolCallCard` 组件内部 | 工具执行时在卡片中实时展示进度文字（如 Bash 命令实时输出） |

### 6.3 三级：不进 UI，仅透传 raw 数据（15 种）

以下事件通过 `sdk:raw-message` 通道进入 `rawMessages` 数组，UI 不做专门渲染：

| 事件 | 不进 UI 的原因 |
|------|---------------|
| `sdk:tool-summary` | 已有 `tool:call-completed` 展示调用结果 |
| `sdk:local-command-output` | Electron 桌面应用无 CLI 终端 |
| `sdk:plugin-install` | 当前无插件系统，预留 |
| `sdk:files-persisted` | SDK 内部事件，用户无需感知 |
| `sdk:memory-recall` | 内部机制，暂不展示 |
| `sdk:mirror-error` | SessionStore 未启用 |
| `sdk:elicitation-complete` | MCP 引出交互完结，内部事件 |
| `sdk:user-message-replay` | 会话恢复内部机制 |
| `sdk:compact-boundary` | 上下文压缩内部标记 |
| `sdk:deferred-tool-use` | 内部机制 |
| `sdk:hook-event`（3 种 stage） | Debug 用途，当前不展示 |
| `sdk:session-changed`（扩充 `state` 字段） | 会话状态由侧边栏管理，不额外展示 |

### 6.4 影响组件

| 组件 | 改动类型 |
|------|---------|
| `MessageStream.tsx` | 新增速率限制警告横幅 + 系统通知气泡 |
| `ToolCallCard.tsx` | 新增进度文字展示区域 |
| `TestConsole.tsx` | 扩充任务状态标签 |

---

## 七、错误处理

| 场景 | 处理方式 |
|------|---------|
| SDK 消息字段缺失 | 使用默认值（空字符串、空数组），不抛异常（与现有 `summarize()` 行为一致） |
| 未知 subtype | 走现有 `sdk:system-event` 兜底（已有逻辑不修改） |
| mapper 抛异常 | `drainMessages` 的 `for await` 循环内异常会被 SDK 子进程捕获，映射失败的消息静默跳过，不影响后续消息处理 |
| UI reducer 中 payload 类型不符 | `payloadRecord()` 安全转换，字段缺失时用默认值（与现有 reducer 行为一致） |

## 八、测试策略

### 7.1 领域层测试（`testRun.test.ts`）

- 14 个新 RunEvent 类型经 `applyRunEvent` 处理后返回原 run 不变
- 3 个扩充类型保持向后兼容（旧字段不变，新字段为可选）

### 7.2 Mapper 测试（`runEventMapper.test.ts`）

- 每种新消息 → 产出正确的结构化 RunEvent（字段映射验证）
- 同时保留 `sdk:raw-message`（raw 消息共存验证）
- 字段缺失时使用默认值（不抛异常）
- `tool_progress` stream_event 和 `task_progress` system 消息不冲突

### 7.3 UI reducer 测试（`sdkEventStore.test.ts`）

- `sdk:tool-progress` 追加/覆盖 `toolProgress` Map
- `sdk:task-notification` 追加到 `taskNotifications`，200 条截断
- `sdk:notification` 追加到 `notifications`
- `sdk:rate-limit` 覆盖 `rateLimitInfo`
- `sdk:mirror-error` 追加到 `mirrorErrors`
- `createInitialSdkUiState` 包含新字段的默认值

### 7.4 类型检查

```bash
npm run build  # tsc 三遍（主进程 + preload + 渲染进程）
```

## 九、不在范围内

- 不做 `SDKPromptSuggestionMessage` 映射（依赖 Anthropic 建议模型，第三方 API 不适用）
- 不做消息类型的 UI 组件展示（留给后续 UI spec）
- 不做 `runEventMapper` 重构（仅追加逻辑，现有结构不变）
- 不新增 IPC 通道（新事件走现有 `mainToRendererChannels` 的 `sdk:*` 前缀通道）
