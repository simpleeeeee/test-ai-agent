# Spec 3: SDK 消息类型映射补全

> **状态**: 设计已确认，待实现
> **日期**: 2026-05-31
> **前提**: 本项目仅使用中国大陆第三方 LLM API，不使用 Anthropic 官方 API
> **依赖**: 无强依赖（独立于 Spec 1、Spec 2）

## 一、概述

Claude Agent SDK 子进程产出 ~30 种消息类型，当前 `runEventMapper.ts` 映射了约 12 种核心类型（流式消息、result、部分 system 消息），还有 20 种未映射（排除 `SDKPromptSuggestionMessage`，它依赖 Anthropic 建议模型，第三方 API 不会产出）。

本 spec 将这 20 种消息全部映射为结构化 `RunEvent`，采用**细粒度**策略——每种消息对应一个独立 RunEvent 类型。

## 二、影响文件

| 文件 | 改动类型 | 是否触发 IPC 同步 |
|------|---------|:---:|
| `src/domain/testRun.ts` | 新增 14 个 RunEvent 类型 + 3 个扩充 + `applyRunEvent` 透传 | 否 |
| `electron/agent/runEventMapper.ts` | `mapSdkMessageWithSession()` 新增 4 种 + `mapNonStreamSdkMessage()` 新增 16 种 | 否 |
| `src/app/sdkUiTypes.ts` | 新增 5 个 UI 状态字段 | 否 |
| `src/app/sdkEventStore.ts` | 新增 7 个 reducer case | 否 |
| `src/ipc/channels.ts` | `mainToRendererChannels` 追加 17 个通道 | **是** |
| `src/app/backendBridge.ts` | `streamChannels` 数组追加 17 个通道 | **是** |
| `electron/preload.ts` | 重新编译（通道白名单变更） | **是** |
| `electron/preloadApi.ts` | 无需变更（`on()` 使用 `isMainToRendererChannel` 动态校验） | 否 |
| `electron/main.ts` | 无需变更（`emitRunEvent` 已自动处理，但需重新编译） | 否 |
| `electron/agent/runEventMapper.test.ts` | 新增消息映射测试 | 否 |
| `src/domain/testRun.test.ts` | 新增 RunEvent 类型透传测试 | 否 |
| `src/app/sdkEventStore.test.ts` | 新增 reducer case 测试 | 否 |

> **重要纠正**：新增的 14 个 `RunEvent.type`（以及 3 个扩充类型的字段）在 `agentSessionManager.emitRunEvent()` 中被用作 `MainToRendererChannel` 推送到渲染进程。这些新字符串**必须**加入 `mainToRendererChannels` 白名单，否则 `isMainToRendererChannel` 守卫会拦截它们。同样，`backendBridge.ts` 的 `streamChannels` 数组也必须同步追加。

## 三、IPC 通道同步约束

> **强制规则**：本 spec 新增 17 个 `mainToRendererChannels`（14 个新 RunEvent 类型 + 3 个扩充类型的新 event.type 值）。

### 3.1 新增通道清单（17 个）

| # | 新通道名 | 来源 | 方向 |
|---|---------|------|:--:|
| 1 | `sdk:tool-progress` | 新增 RunEvent 类型 | main→renderer |
| 2 | `sdk:tool-summary` | 新增 RunEvent 类型 | main→renderer |
| 3 | `sdk:task-notification` | 新增 RunEvent 类型 | main→renderer |
| 4 | `sdk:notification` | 新增 RunEvent 类型 | main→renderer |
| 5 | `sdk:local-command-output` | 新增 RunEvent 类型 | main→renderer |
| 6 | `sdk:plugin-install` | 新增 RunEvent 类型 | main→renderer |
| 7 | `sdk:rate-limit` | 新增 RunEvent 类型 | main→renderer |
| 8 | `sdk:files-persisted` | 新增 RunEvent 类型 | main→renderer |
| 9 | `sdk:memory-recall` | 新增 RunEvent 类型 | main→renderer |
| 10 | `sdk:mirror-error` | 新增 RunEvent 类型 | main→renderer |
| 11 | `sdk:elicitation-complete` | 新增 RunEvent 类型 | main→renderer |
| 12 | `sdk:user-message-replay` | 新增 RunEvent 类型 | main→renderer |
| 13 | `sdk:compact-boundary` | 新增 RunEvent 类型 | main→renderer |
| 14 | `sdk:deferred-tool-use` | 新增 RunEvent 类型 | main→renderer |
| 15 | `sdk:task-progress` | 扩充已有类型（已有通道，无需追加，需确认已存在） | — |
| 16 | `sdk:hook-event` | 扩充已有类型（已有通道，无需追加，需确认已存在） | — |
| 17 | `sdk:session-changed` | 扩充已有类型（已有通道，无需追加，需确认已存在） | — |

> #1–#14 是全新通道，必须追加；#15–#17 已存在于 `mainToRendererChannels`（已确认），但字段变更需要重新编译。

### 3.2 同步清单（6 文件）

| # | 文件 | 职责 | 本 spec 变更 |
|---|------|------|------------|
| 1 | `src/ipc/channels.ts` | `mainToRendererChannels` 白名单 | 追加 14 个新通道 |
| 2 | `src/app/backendBridge.ts` | `streamChannels` 订阅数组 | 追加 14 个新通道 |
| 3 | `electron/main.ts` | 主进程入口 | 重新编译（无代码改动） |
| 4 | `electron/preload.ts` | preload 入口 | 重新编译（通道白名单变更后需重新打包） |
| 5 | `electron/preloadApi.ts` | 安全暴露白名单 | 无需变更（`on()` 通过 `isMainToRendererChannel` 动态校验） |
| 6 | `src/ipc/payloadSchemas.ts` | Zod 校验 schema | 无需变更（push 通道没有 payload schema） |

### 3.3 每个通道的同步链路

以 `sdk:rate-limit` 为例：

```
① src/ipc/channels.ts
   mainToRendererChannels 追加 "sdk:rate-limit"

② src/app/backendBridge.ts
   streamChannels 数组追加 "sdk:rate-limit"

③ electron/main.ts
   无需代码改动 — emitRunEvent() 通过 event.type as MainToRendererChannel
   传递，sendToRenderer() 会调用 isMainToRendererChannel 校验

④ electron/preload.ts
   无需代码改动 — 重新编译即可
```

### 3.4 强制验证步骤

```bash
# 步骤 1：通道定义一致性
npm test -- src/ipc/channels.test.ts electron/preload.test.ts

# 步骤 2：完整类型检查（渲染进程 + 主进程 + preload 三遍 tsc）
npm run build
```

### 3.5 漂移风险点

- `mainToRendererChannels` 和 `streamChannels` 两个数组必须包含相同的新通道名
- 如果只在 `channels.ts` 加而忘记 `backendBridge.ts` 的 `streamChannels`，渲染进程的 `subscribe()` 不会监听新事件
- 如果只在 `backendBridge.ts` 加而忘记 `channels.ts`，`sendToRenderer()` 会拦截这些事件并打印 `Blocked main→renderer channel` 警告

---

## 四、RunEvent 类型扩展

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

## 五、runEventMapper 变更

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

## 六、UI 状态层变更

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

## 七、UI 层展示设计

新增的 20 种事件按用户可见性分为三级。

### 7.1 一级：需要独立 UI 控件（3 种）

#### 7.1.1 速率限制警告横幅 — `sdk:rate-limit`

**展示位置**: `MessageStream` 中，消息列表顶部（`.message-column` 的第一个子元素，在消息列表前）

**CSS 类名**: `.rate-limit-banner`

**样式规范**（引用 `styles.css` 设计令牌）:

```css
.rate-limit-banner {
  /* 布局：与历史加载横幅一致 */
  align-items: center;
  background: #fff9ef;           /* 暖黄色背景，匹配现有 composer-notice */
  border: 1px solid #ead9c7;     /* composer-notice 同款边框 */
  border-radius: var(--radius-xl); /* 14px，与 history-loading-banner 一致 */
  color: #70584d;                /* composer-notice 同款文字色 */
  display: inline-flex;
  gap: 10px;
  justify-content: center;
  min-height: 46px;
  padding: 10px 14px;
  width: min(520px, calc(100% - 72px));
  font-size: var(--font-sm);     /* 12px */
  box-shadow: var(--shadow-sm);
}

.rate-limit-banner .rate-limit-icon {
  color: #d97757;                /* var(--accent)，用作警告图标色 */
  flex: none;
}

.rate-limit-banner .rate-limit-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rate-limit-banner .rate-limit-title {
  font-weight: 600;
  color: #70584d;
}

.rate-limit-banner .rate-limit-detail {
  font-size: var(--font-xs);     /* 11px */
  color: var(--text-secondary);  /* #6b6960 */
}
```

**交互行为**:
- 速率限制触发时显示，限制解除后消失（由 `rateLimitInfo` 从 `undefined` 变为有值控制显示）
- 横幅为**只读提示**，不可点击关闭
- 从 payload 提取 `tokensRemaining` 和 `resetTime` 展示剩余 token 数和重置时间
- 暗色模式下背景和文字色不变（警告色不做 dark 适配，与 `composer-notice` 行为一致）

#### 7.1.2 系统通知气泡 — `sdk:notification`

**展示位置**: `MessageStream` 的消息流中，作为独立元素插入在消息列表里

**CSS 类名**: `.system-notification`

**样式规范**:

```css
.system-notification {
  /* 灰色小字，与用户/助手消息明显区分 */
  color: var(--text-tertiary);   /* #b0aea5 */
  font-size: var(--font-xs);     /* 11px */
  text-align: center;
  padding: 4px 14px;
  line-height: 1.4;
  max-width: var(--message-max-width); /* 650px */
  margin: 0 auto;
  user-select: none;
}
```

**交互行为**:
- 纯文本展示，无交互
- 每个通知作为独立元素渲染在消息列表中
- 多条通知按时间顺序排列
- 通知类型 `notificationType` 作为 `data-notification-type` 属性挂载（CSS 可据此区分样式）

#### 7.1.3 任务状态更新条目 — `sdk:task-notification`

**展示位置**: `TestConsole` 的 `.test-console-body` 中

**CSS 类名**: `.task-notification-item`（复用现有 `.monitor-card` 模式）

**样式规范**:

```css
.task-notification-item {
  /* 继承 monitor-card 的基础样式 */
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);  /* 11px，与 monitor-card 一致 */
  display: grid;
  gap: 4px;
  padding: 10px 12px;
}

.task-notification-item .task-notification-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-sm);    /* 12px */
  color: var(--text-primary);
  font-weight: 520;
}

.task-notification-item .task-notification-status {
  font-size: var(--font-xs);    /* 11px */
  color: var(--text-secondary);
}
```

**交互行为**:
- 每个任务通知作为独立卡片展示
- 无点击交互，纯信息展示
- `status` 字段决定状态文字颜色（`completed` → `var(--green)`，`failed` → `var(--red)`）

### 7.2 二级：扩充现有控件（2 种）

#### 7.2.1 任务进度状态标签 — 扩充 `sdk:task-progress`

**展示位置**: `TestConsole` 中现有的 `.sdk-task` 元素

**改动内容**: 在现有 `summary` 文字旁增加一个 `<span>` 状态标签

**CSS 类名**: `.task-status-label`

**样式规范**:

```css
.task-status-label {
  display: inline-block;
  font-size: var(--font-xs);    /* 11px */
  padding: 1px 6px;
  border-radius: var(--radius-full); /* 9999px */
  margin-left: 6px;
  font-weight: 520;
}

.task-status-label.status-started {
  background: var(--accent-soft);  /* rgba(217, 119, 87, 0.15) */
  color: var(--accent);            /* #d97757 */
}

.task-status-label.status-updated {
  background: var(--bg-pill);      /* #eef1f6 */
  color: #465369;                  /* model-pill 同款色 */
}
```

**交互行为**:
- 纯标签，无交互
- 当 `status === "started"` 时渲染 `status-started`，`status === "updated"` 时渲染 `status-updated`

#### 7.2.2 工具执行进度 — 扩充 `sdk:tool-progress`

**展示位置**: `ToolCallCard` 组件内部，在 `.tool-call-header` 和 `.tool-call-detail` 之间

**CSS 类名**: `.tool-call-progress`

**样式规范**:

```css
.tool-call-progress {
  font-family: var(--font-mono);   /* 等宽字体 */
  font-size: var(--font-xs);       /* 11px */
  color: var(--text-secondary);    /* #6b6960 */
  padding: 4px 12px;
  background: var(--bg-sidebar);   /* #e8e6dc */
  border-radius: var(--radius-md); /* 8px */
  line-height: 1.45;
  white-space: pre-wrap;
  max-height: 80px;
  overflow-y: auto;
  margin-top: 4px;
}
```

**交互行为**:
- 纯进度文字展示，不可展开/折叠
- `status === "running"` 时显示，`status === "completed"` 时隐藏
- 每次 `sdk:tool-progress` 事件到达时用新 progress 覆盖旧值（不追加）

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

### 7.3 影响组件

| 组件 | 改动类型 | 新增 CSS 类名 |
|------|---------|-------------|
| `MessageStream.tsx` | 新增速率限制警告横幅 + 系统通知气泡 | `.rate-limit-banner`、`.system-notification` |
| `ToolCallCard.tsx` | 新增进度文字展示区域 | `.tool-call-progress` |
| `TestConsole.tsx` | 扩充任务状态标签 + 新增任务通知卡 | `.task-status-label`、`.task-notification-item` |

所有新增样式写入 `src/ui/styles.css`，引用现有设计令牌（`--accent`、`--text-secondary`、`--bg-card` 等），支持亮/暗双主题。

---

## 八、错误处理

| 场景 | 处理方式 |
|------|---------|
| SDK 消息字段缺失 | 使用默认值（空字符串、空数组），不抛异常（与现有 `summarize()` 行为一致） |
| 未知 subtype | 走现有 `sdk:system-event` 兜底（已有逻辑不修改） |
| mapper 抛异常 | `drainMessages` 的 `for await` 循环内异常会被 SDK 子进程捕获，映射失败的消息静默跳过，不影响后续消息处理 |
| UI reducer 中 payload 类型不符 | `payloadRecord()` 安全转换，字段缺失时用默认值（与现有 reducer 行为一致） |

## 九、测试策略

### 9.1 领域层测试（`testRun.test.ts`）

- 14 个新 RunEvent 类型经 `applyRunEvent` 处理后返回原 run 不变
- 3 个扩充类型保持向后兼容（旧字段不变，新字段为可选）

### 9.2 Mapper 测试（`runEventMapper.test.ts`）

- 每种新消息 → 产出正确的结构化 RunEvent（字段映射验证）
- 同时保留 `sdk:raw-message`（raw 消息共存验证）
- 字段缺失时使用默认值（不抛异常）
- `tool_progress` stream_event 和 `task_progress` system 消息不冲突

### 9.3 UI reducer 测试（`sdkEventStore.test.ts`）

- `sdk:tool-progress` 追加/覆盖 `toolProgress` Map
- `sdk:task-notification` 追加到 `taskNotifications`，200 条截断
- `sdk:notification` 追加到 `notifications`
- `sdk:rate-limit` 覆盖 `rateLimitInfo`
- `sdk:mirror-error` 追加到 `mirrorErrors`
- `createInitialSdkUiState` 包含新字段的默认值

### 9.4 构建验证（强制）

每次修改后必须按顺序执行：

```bash
# 步骤 1：通道定义一致性
npm test -- src/ipc/channels.test.ts electron/preload.test.ts

# 步骤 2：完整类型检查（渲染进程 + 主进程 + preload 三遍 tsc）
npm run build
```

## 十、不在范围内

- 不做 `SDKPromptSuggestionMessage` 映射（依赖 Anthropic 建议模型，第三方 API 不适用）
- 不做消息类型的 UI 组件展示（留给后续 UI spec）
- 不做 `runEventMapper` 重构（仅追加逻辑，现有结构不变）
- 不新增 IPC 通道（新事件走现有 `mainToRendererChannels` 的 `sdk:*` 前缀通道）
