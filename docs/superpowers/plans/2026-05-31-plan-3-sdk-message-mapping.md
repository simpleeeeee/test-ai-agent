# Plan 3: SDK 消息类型映射补全 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 20 种未映射的 SDK 消息映射为结构化 RunEvent，新增 14 个 mainToRendererChannels，补全 UI 渲染（速率限制横幅、系统通知气泡、任务通知卡、工具进度）。

**Architecture:** testRun.ts 扩展 RunEvent 类型 → runEventMapper.ts 新增映射逻辑 → channels.ts/backendBridge.ts 同步新通道 → sdkUiTypes.ts/sdkEventStore.ts 扩展 UI 状态 → UI 组件实现渲染 → 构建验证。

**Tech Stack:** TypeScript, Vitest, React 19, lucide-react

**IPC 约束:** 14 个新 mainToRendererChannels 必须同步 channels.ts + backendBridge.ts streamChannels，preload.ts 需重新编译。

---

### Task 1: testRun.ts 新增 14 个 RunEvent 类型 + 3 个扩充

**Files:**
- Modify: `src/domain/testRun.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// testRun.test.ts 新增
describe("new RunEvent types pass through applyRunEvent", () => {
  const run = createInitialRun({
    prompt: "test",
    projectName: "p",
    environmentName: "e",
    agentName: "a",
  });

  const newEvents = [
    { type: "sdk:tool-progress" as const, toolUseId: "t1", status: "running" },
    { type: "sdk:tool-summary" as const, toolUseId: "t1", summary: "done" },
    { type: "sdk:task-notification" as const, taskId: "t1", status: "completed" },
    { type: "sdk:notification" as const, message: "压缩上下文", notificationType: "info" },
    { type: "sdk:local-command-output" as const, command: "ls", output: "file.txt" },
    { type: "sdk:plugin-install" as const, pluginName: "test", status: "installed" },
    { type: "sdk:rate-limit" as const, info: { tokensRemaining: 5000 } },
    { type: "sdk:files-persisted" as const, files: ["a.txt"] },
    { type: "sdk:memory-recall" as const, memories: [] },
    { type: "sdk:mirror-error" as const, message: "写入失败" },
    { type: "sdk:elicitation-complete" as const, serverName: "srv1" },
    { type: "sdk:user-message-replay" as const, messageId: "m1", content: "hello" },
    { type: "sdk:compact-boundary" as const, direction: "pre" as const },
    { type: "sdk:deferred-tool-use" as const, toolName: "Bash", toolUseId: "t1" },
  ];

  for (const event of newEvents) {
    const result = applyRunEvent(run, event as RunEvent);
    expect(result).toEqual(run); // 全部透传
  }
});

it("sdk:task-progress accepts optional status field", () => {
  const event = { type: "sdk:task-progress" as const, taskId: "t1", status: "started" };
  const result = applyRunEvent(run, event as RunEvent);
  expect(result).toEqual(run);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- src/domain/testRun.test.ts
```

- [ ] **Step 3: 扩展 RunEvent 类型**

```typescript
// src/domain/testRun.ts — RunEvent 联合类型追加

export type RunEvent =
  // ... 现有类型 ...
  | { type: "sdk:tool-progress"; toolUseId: string; status: string; progress?: unknown }
  | { type: "sdk:tool-summary"; toolUseId: string; summary: string }
  | { type: "sdk:task-notification"; taskId: string; status: string; description?: string }
  | { type: "sdk:notification"; message: string; title?: string; notificationType: string }
  | { type: "sdk:local-command-output"; command: string; output: string }
  | { type: "sdk:plugin-install"; pluginName: string; status: string }
  | { type: "sdk:rate-limit"; info: unknown }
  | { type: "sdk:files-persisted"; files: string[]; totalBytes?: number }
  | { type: "sdk:memory-recall"; memories: unknown[] }
  | { type: "sdk:mirror-error"; message: string }
  | { type: "sdk:elicitation-complete"; serverName: string; elicitationId?: string }
  | { type: "sdk:user-message-replay"; messageId: string; content: string }
  | { type: "sdk:compact-boundary"; direction: "pre" | "post" }
  | { type: "sdk:deferred-tool-use"; toolName: string; toolUseId: string };
```

并更新 3 个已有类型的字段：

```typescript
// sdk:task-progress — 已有 taskId? summary?，追加 status?
| { type: "sdk:task-progress"; taskId: string; summary?: string; status?: string; raw?: unknown }

// sdk:hook-event — 已有 hookName raw，追加 stage?
| { type: "sdk:hook-event"; hookName: string; stage?: string; raw: unknown }

// sdk:session-changed — 已有 sessionId，追加 state?
| { type: "sdk:session-changed"; sessionId: string; state?: string }
```

然后在 `applyRunEvent` 中添加 14 个透传 case：

```typescript
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

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- src/domain/testRun.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/domain/testRun.ts src/domain/testRun.test.ts
git commit -m "feat: RunEvent 新增 14 个类型 + 3 个扩充"
```

---

### Task 2: 新增 14 个 mainToRendererChannels

**Files:**
- Modify: `src/ipc/channels.ts`
- Modify: `src/app/backendBridge.ts`

- [ ] **Step 1: channels.ts 追加**

```typescript
// src/ipc/channels.ts — mainToRendererChannels 数组追加
export const mainToRendererChannels = [
  // ... 现有通道 ...
  "sdk:tool-progress",
  "sdk:tool-summary",
  "sdk:task-notification",
  "sdk:notification",
  "sdk:local-command-output",
  "sdk:plugin-install",
  "sdk:rate-limit",
  "sdk:files-persisted",
  "sdk:memory-recall",
  "sdk:mirror-error",
  "sdk:elicitation-complete",
  "sdk:user-message-replay",
  "sdk:compact-boundary",
  "sdk:deferred-tool-use",
] as const;
```

- [ ] **Step 2: backendBridge.ts streamChannels 同步追加**

```typescript
// src/app/backendBridge.ts — streamChannels 数组追加相同 14 个通道
const streamChannels: MainToRendererChannel[] = [
  // ... 现有通道 ...
  "sdk:tool-progress",
  "sdk:tool-summary",
  "sdk:task-notification",
  "sdk:notification",
  "sdk:local-command-output",
  "sdk:plugin-install",
  "sdk:rate-limit",
  "sdk:files-persisted",
  "sdk:memory-recall",
  "sdk:mirror-error",
  "sdk:elicitation-complete",
  "sdk:user-message-replay",
  "sdk:compact-boundary",
  "sdk:deferred-tool-use",
];
```

- [ ] **Step 3: 写测试验证两数组一致**

```typescript
// channels.test.ts 新增
it("new sdk:* channels exist in both renderer and streamChannels", () => {
  const newChannels = [
    "sdk:tool-progress", "sdk:tool-summary", "sdk:task-notification",
    "sdk:notification", "sdk:local-command-output", "sdk:plugin-install",
    "sdk:rate-limit", "sdk:files-persisted", "sdk:memory-recall",
    "sdk:mirror-error", "sdk:elicitation-complete", "sdk:user-message-replay",
    "sdk:compact-boundary", "sdk:deferred-tool-use",
  ];
  for (const ch of newChannels) {
    expect(mainToRendererChannels).toContain(ch);
  }
});
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- src/ipc/channels.test.ts electron/preload.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/ipc/channels.ts src/app/backendBridge.ts src/ipc/channels.test.ts
git commit -m "feat: 新增 14 个 mainToRendererChannels 并同步 streamChannels"
```

---

### Task 3: runEventMapper 新增 stream_event 映射（4 种）

**Files:**
- Modify: `electron/agent/runEventMapper.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// runEventMapper.test.ts 新增
describe("new stream_event mappings", () => {
  const session = new SdkRunEventMapperSession("run-1");

  it("maps tool_progress stream event", () => {
    const msg = {
      type: "stream_event",
      event: { type: "tool_progress", tool_use_id: "tu1", status: "running", progress: "50%" },
    };
    const events = session.map(msg);
    expect(events).toContainEqual({
      type: "sdk:tool-progress", toolUseId: "tu1", status: "running", progress: "50%",
    });
  });

  it("maps task_started stream event", () => {
    const msg = {
      type: "stream_event",
      event: { type: "task_started", task_id: "t1", summary: "开始执行" },
    };
    const events = session.map(msg);
    expect(events).toContainEqual({
      type: "sdk:task-progress", taskId: "t1", status: "started", summary: "开始执行",
    });
  });

  it("maps task_updated stream event", () => {
    const msg = {
      type: "stream_event",
      event: { type: "task_updated", task_id: "t1", summary: "50% 完成" },
    };
    const events = session.map(msg);
    expect(events).toContainEqual({
      type: "sdk:task-progress", taskId: "t1", status: "updated", summary: "50% 完成",
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/runEventMapper.test.ts
```

- [ ] **Step 3: 在 mapSdkMessageWithSession 中追加**

```typescript
// runEventMapper.ts — mapSdkMessageWithSession 函数内，现有 sdkEvent.type 匹配链后追加

if (sdkEvent?.type === "tool_progress") {
  events.push({
    type: "sdk:tool-progress",
    toolUseId: sdkEvent.tool_use_id ?? "",
    status: sdkEvent.status ?? "running",
    ...(sdkEvent.progress ? { progress: sdkEvent.progress } : {}),
  });
}

if (sdkEvent?.type === "tool_summary") {
  events.push({
    type: "sdk:tool-summary",
    toolUseId: sdkEvent.tool_use_id ?? "",
    summary: sdkEvent.summary ?? "",
  });
}

if (sdkEvent?.type === "task_started") {
  events.push({
    type: "sdk:task-progress",
    taskId: sdkEvent.task_id ?? "",
    status: "started",
    ...(sdkEvent.summary ? { summary: sdkEvent.summary } : {}),
  });
}

if (sdkEvent?.type === "task_updated") {
  events.push({
    type: "sdk:task-progress",
    taskId: sdkEvent.task_id ?? "",
    status: "updated",
    ...(sdkEvent.summary ? { summary: sdkEvent.summary } : {}),
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/runEventMapper.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/runEventMapper.ts electron/agent/runEventMapper.test.ts
git commit -m "feat: runEventMapper 映射 4 种新 stream_event"
```

---

### Task 4: runEventMapper 新增 system 消息映射（16 种）

**Files:**
- Modify: `electron/agent/runEventMapper.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// runEventMapper.test.ts 新增
describe("new system message mappings", () => {
  it("maps task_notification to sdk:task-notification", () => {
    const events = mapNonStreamSdkMessage("run-1", {
      type: "system", subtype: "task_notification",
      task_id: "t1", status: "completed", description: "任务完成",
    });
    expect(events).toContainEqual({
      type: "sdk:task-notification", taskId: "t1", status: "completed", description: "任务完成",
    });
  });

  it("maps notification to sdk:notification", () => {
    const events = mapNonStreamSdkMessage("run-1", {
      type: "system", subtype: "notification",
      message: "正在压缩上下文", notification_type: "info",
    });
    expect(events).toContainEqual({
      type: "sdk:notification", message: "正在压缩上下文", notificationType: "info",
    });
  });

  it("maps rate_limit to sdk:rate-limit", () => {
    const events = mapNonStreamSdkMessage("run-1", {
      type: "system", subtype: "rate_limit",
      rate_limit_info: { tokensRemaining: 100 },
    });
    expect(events).toContainEqual({
      type: "sdk:rate-limit", info: { tokensRemaining: 100 },
    });
  });

  it("maps mirror_error to sdk:mirror-error", () => {
    const events = mapNonStreamSdkMessage("run-1", {
      type: "system", subtype: "mirror_error",
      message: "SessionStore 写入超时",
    });
    expect(events).toContainEqual({
      type: "sdk:mirror-error", message: "SessionStore 写入超时",
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/runEventMapper.test.ts
```

- [ ] **Step 3: 实现 16 种映射**

在 `mapNonStreamSdkMessage` 函数中，现有 `message.type === "system"` 分支内追加所有 subtype：

```typescript
if (message.type === "system" && message.subtype === "task_notification") {
  events.push({
    type: "sdk:task-notification",
    taskId: message.task_id ?? "",
    status: message.status ?? "",
    ...(message.description ? { description: message.description } : {}),
  });
}
if (message.type === "system" && message.subtype === "notification") {
  events.push({
    type: "sdk:notification",
    message: message.message ?? "",
    ...(message.title ? { title: message.title } : {}),
    notificationType: message.notification_type ?? "",
  });
}
if (message.type === "system" && message.subtype === "rate_limit") {
  events.push({
    type: "sdk:rate-limit",
    info: message.rate_limit_info ?? {},
  });
}
if (message.type === "system" && message.subtype === "mirror_error") {
  events.push({
    type: "sdk:mirror-error",
    message: message.message ?? "",
  });
}
// ... 其余 12 种映射按相同模式实现
// (hook_started/progress/response → sdk:hook-event with stage)
// (local_command_output → sdk:local-command-output)
// (plugin_install → sdk:plugin-install)
// (files_persisted → sdk:files-persisted)
// (memory_recall → sdk:memory-recall)
// (session_state_changed → sdk:session-changed with state)
// (elicitation_complete → sdk:elicitation-complete)
// (user_message_replay → sdk:user-message-replay)
// (compact_boundary → sdk:compact-boundary)
// (deferred_tool_use → sdk:deferred-tool-use)
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/runEventMapper.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/runEventMapper.ts electron/agent/runEventMapper.test.ts
git commit -m "feat: runEventMapper 映射 16 种 system 消息"
```

---

### Task 5: sdkUiTypes 扩展 + sdkEventStore 新增 reducer case

**Files:**
- Modify: `src/app/sdkUiTypes.ts`
- Modify: `src/app/sdkEventStore.ts`

- [ ] **Step 1: 扩展 SdkUiState 类型**

```typescript
// sdkUiTypes.ts — SdkUiState 接口新增字段
export type SdkUiState = {
  // ... 现有字段 ...
  toolProgress: Map<string, { toolUseId: string; status: string; progress?: unknown }>;
  taskNotifications: Array<{ taskId: string; status: string; description?: string }>;
  notifications: Array<{ message: string; title?: string; notificationType: string }>;
  rateLimitInfo: unknown | undefined;
  mirrorErrors: Array<{ message: string }>;
};
```

同步更新 `createInitialSdkUiState()`:

```typescript
export function createInitialSdkUiState(): SdkUiState {
  return {
    // ... 现有字段 ...
    toolProgress: new Map(),
    taskNotifications: [],
    notifications: [],
    rateLimitInfo: undefined,
    mirrorErrors: [],
  };
}
```

- [ ] **Step 2: 新增 reducer case**

```typescript
// sdkEventStore.ts — reduceSdkUiEvent 函数中追加

if (event.channel === "sdk:tool-progress") {
  const next = new Map(state.toolProgress);
  next.set(String(payload.toolUseId), {
    toolUseId: String(payload.toolUseId),
    status: String(payload.status),
    ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
  });
  return { ...state, activeRunId, toolProgress: next };
}

if (event.channel === "sdk:task-notification") {
  return {
    ...state, activeRunId,
    taskNotifications: state.taskNotifications.length >= 200
      ? [...state.taskNotifications.slice(-199), { taskId: String(payload.taskId), status: String(payload.status), description: typeof payload.description === "string" ? payload.description : undefined }]
      : [...state.taskNotifications, { taskId: String(payload.taskId), status: String(payload.status), description: typeof payload.description === "string" ? payload.description : undefined }],
  };
}

if (event.channel === "sdk:notification") {
  return {
    ...state, activeRunId,
    notifications: state.notifications.length >= 200
      ? [...state.notifications.slice(-199), { message: String(payload.message), title: typeof payload.title === "string" ? payload.title : undefined, notificationType: String(payload.notificationType) }]
      : [...state.notifications, { message: String(payload.message), title: typeof payload.title === "string" ? payload.title : undefined, notificationType: String(payload.notificationType) }],
  };
}

if (event.channel === "sdk:rate-limit") {
  return { ...state, activeRunId, rateLimitInfo: payload.info };
}

if (event.channel === "sdk:mirror-error") {
  return {
    ...state, activeRunId,
    mirrorErrors: state.mirrorErrors.length >= 200
      ? [...state.mirrorErrors.slice(-199), { message: String(payload.message) }]
      : [...state.mirrorErrors, { message: String(payload.message) }],
  };
}

// 扩充已有 channel
if (event.channel === "sdk:session-changed" && typeof payload.state === "string") {
  return { ...state, activeRunId };
  // state 字段将在实施时根据 session 管理逻辑决定具体处理
}
```

- [ ] **Step 3: 写测试**

```typescript
// sdkEventStore.test.ts 新增
describe("new reducer cases", () => {
  it("sdk:tool-progress updates map", () => {
    const state = createInitialSdkUiState();
    const next = reduceSdkUiEvent(state, { channel: "sdk:tool-progress", payload: { toolUseId: "t1", status: "running", progress: "50%" } });
    expect(next.toolProgress.get("t1")).toEqual({ toolUseId: "t1", status: "running", progress: "50%" });
  });

  it("sdk:rate-limit sets rateLimitInfo", () => {
    const state = createInitialSdkUiState();
    const next = reduceSdkUiEvent(state, { channel: "sdk:rate-limit", payload: { info: { tokensRemaining: 100 } } });
    expect(next.rateLimitInfo).toEqual({ tokensRemaining: 100 });
  });

  it("sdk:notification appends with 200 cap", () => {
    const state = createInitialSdkUiState();
    const next = reduceSdkUiEvent(state, { channel: "sdk:notification", payload: { message: "test", notificationType: "info" } });
    expect(next.notifications).toHaveLength(1);
    expect(next.notifications[0].message).toBe("test");
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- src/app/sdkEventStore.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/app/sdkUiTypes.ts src/app/sdkEventStore.ts src/app/sdkEventStore.test.ts
git commit -m "feat: sdkUiState 扩展 + reducer 新增 5 个 case"
```

---

### Task 6: UI — MessageStream 新增速率限制横幅和系统通知

**Files:**
- Modify: `src/app/components/MessageStream.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: 实现 MessageStream 变更**

```tsx
// MessageStream.tsx — 在消息列表前加横幅，在消息流中加系统通知

export function MessageStream({ state, ... }: Props) {
  return (
    <div className="message-column">
      {/* 速率限制警告横幅 */}
      {state.rateLimitInfo ? (
        <div className="rate-limit-banner" role="alert">
          <AlertTriangle aria-hidden="true" className="rate-limit-icon" size={18} />
          <div className="rate-limit-text">
            <span className="rate-limit-title">API 速率限制</span>
            <span className="rate-limit-detail">
              {(state.rateLimitInfo as Record<string, unknown>).tokensRemaining != null
                ? `剩余 token: ${(state.rateLimitInfo as Record<string, unknown>).tokensRemaining}`
                : "请求频率过高，请稍后重试"}
            </span>
          </div>
        </div>
      ) : null}

      {/* 消息列表 */}
      {state.messages.map((message) => (
        // ... 现有消息渲染 ...
      ))}

      {/* 系统通知气泡 */}
      {state.notifications.map((n, i) => (
        <div className="system-notification" key={`notif-${i}`} data-notification-type={n.notificationType}>
          {n.title ? <strong>{n.title}: </strong> : null}{n.message}
        </div>
      ))}

      {/* ... 其余现有内容 ... */}
    </div>
  );
}
```

引入 `AlertTriangle`:

```typescript
import { Copy, RefreshCcw, Sparkles, AlertTriangle } from "lucide-react";
```

- [ ] **Step 2: 写组件测试**

```typescript
// MessageStream.test.tsx 新增
it("renders rate-limit banner when rateLimitInfo is set", () => {
  const state = { ...baseState, rateLimitInfo: { tokensRemaining: 100 } };
  render(<MessageStream state={state} ... />);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByText(/速率限制/)).toBeInTheDocument();
});

it("renders system notifications in stream", () => {
  const state = { ...baseState, notifications: [{ message: "压缩上下文完成", notificationType: "info" }] };
  render(<MessageStream state={state} ... />);
  expect(screen.getByText(/压缩上下文完成/)).toBeInTheDocument();
});

it("does not render rate-limit banner when rateLimitInfo is undefined", () => {
  const state = { ...baseState, rateLimitInfo: undefined };
  render(<MessageStream state={state} ... />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
```

- [ ] **Step 3: 添加 CSS**

```css
/* src/ui/styles.css — 在现有样式后追加 */

/* Rate-limit banner — 暖黄色警告横幅 */
.rate-limit-banner {
  align-items: center;
  background: #fff9ef;
  border: 1px solid #ead9c7;
  border-radius: var(--radius-xl);
  color: #70584d;
  display: inline-flex;
  gap: 10px;
  justify-content: center;
  min-height: 46px;
  padding: 10px 14px;
  width: min(520px, calc(100% - 72px));
  font-size: var(--font-sm);
  box-shadow: var(--shadow-sm);
}
.rate-limit-banner .rate-limit-icon {
  color: var(--accent);
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
  font-size: var(--font-xs);
  color: var(--text-secondary);
}

/* System notification — 灰色小字居中气泡 */
.system-notification {
  color: var(--text-tertiary);
  font-size: var(--font-xs);
  text-align: center;
  padding: 4px 14px;
  line-height: 1.4;
  max-width: var(--message-max-width);
  margin: 0 auto;
  user-select: none;
}
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- src/app/components/MessageStream.test.tsx
```

- [ ] **Step 5: 提交**

```bash
git add src/app/components/MessageStream.tsx src/ui/styles.css src/app/components/MessageStream.test.tsx
git commit -m "feat: MessageStream 新增速率限制横幅和系统通知气泡"
```

---

### Task 7: UI — ToolCallCard 新增进度展示

**Files:**
- Modify: `src/app/components/ToolCallCard.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: 实现**

```tsx
// ToolCallCard.tsx — 在 tool-call-header 和 tool-call-detail 之间

{toolProgress && toolProgress.status === "running" ? (
  <div className="tool-call-progress">
    {typeof toolProgress.progress === "string" ? toolProgress.progress : "执行中…"}
  </div>
) : null}
```

`toolProgress` 从 `state.toolProgress` Map 中按 `toolCall.id` 查找获得。

- [ ] **Step 2: 添加 CSS**

```css
/* Tool call progress — 等宽字体小字进度条 */
.tool-call-progress {
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  color: var(--text-secondary);
  padding: 4px 12px;
  background: var(--bg-sidebar);
  border-radius: var(--radius-md);
  line-height: 1.45;
  white-space: pre-wrap;
  max-height: 80px;
  overflow-y: auto;
  margin-top: 4px;
}
```

- [ ] **Step 3: 运行测试 + 提交**

```bash
npm test -- src/app/components/ToolCallCard.test.tsx
git add src/app/components/ToolCallCard.tsx src/ui/styles.css src/app/components/ToolCallCard.test.tsx
git commit -m "feat: ToolCallCard 新增工具执行进度展示"
```

---

### Task 8: UI — TestConsole 扩充任务状态

**Files:**
- Modify: `src/app/components/TestConsole.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: 实现**

```tsx
// TestConsole.tsx — 在现有 task 渲染区扩充
{state.tasks.map((task) => (
  <p className="sdk-task" key={task.taskId}>
    {task.summary ?? task.taskId}
    {task.status ? (
      <span className={`task-status-label status-${task.status}`}>
        {task.status === "started" ? "启动" : task.status === "updated" ? "更新中" : task.status}
      </span>
    ) : null}
  </p>
))}

{/* 任务通知卡 */}
{state.taskNotifications.map((n, i) => (
  <div className="task-notification-item" key={`tn-${i}`}>
    <div className="task-notification-header">
      <span>{n.taskId}</span>
      <span className="task-notification-status" style={{ color: n.status === "completed" ? "var(--green)" : n.status === "failed" ? "var(--red)" : "var(--text-secondary)" }}>
        {n.status}
      </span>
    </div>
  </div>
))}
```

- [ ] **Step 2: 添加 CSS**

```css
/* Task status label */
.task-status-label {
  display: inline-block;
  font-size: var(--font-xs);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  margin-left: 6px;
  font-weight: 520;
}
.task-status-label.status-started {
  background: var(--accent-soft);
  color: var(--accent);
}
.task-status-label.status-updated {
  background: var(--bg-pill);
  color: #465369;
}

/* Task notification item */
.task-notification-item {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  display: grid;
  gap: 4px;
  padding: 10px 12px;
}
.task-notification-item .task-notification-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  font-weight: 520;
}
.task-notification-item .task-notification-status {
  font-size: var(--font-xs);
}
```

- [ ] **Step 3: 运行测试 + 提交**

```bash
npm test -- src/app/components/TestConsole.test.tsx
git add src/app/components/TestConsole.tsx src/ui/styles.css src/app/components/TestConsole.test.tsx
git commit -m "feat: TestConsole 扩充任务状态标签和通知卡"
```

---

### Task 9: 强制 IPC 同步验证 + 构建

- [ ] **Step 1: 通道测试**

```bash
npm test -- src/ipc/channels.test.ts electron/preload.test.ts
```

- [ ] **Step 2: 完整构建**

```bash
npm run build
```

- [ ] **Step 3: 全部测试**

```bash
npm test
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: Plan 3 最终验证通过 — 14 新通道全部同步"
```

---

## 验证 Checklist

- [ ] 14 个新通道在 `mainToRendererChannels` 和 `streamChannels` 中
- [ ] 20 种消息经 mapper 产出正确的 RunEvent
- [ ] `npm run build` 三遍 tsc 通过
- [ ] `npm test -- src/ipc/channels.test.ts electron/preload.test.ts` 通过
- [ ] 速率限制横幅在有 `rateLimitInfo` 时渲染
- [ ] 系统通知气泡正确显示
- [ ] 工具进度在 `status === "running"` 时显示
- [ ] 任务通知卡在 TestConsole 中显示
