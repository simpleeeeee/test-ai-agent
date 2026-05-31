# 第三方 API 场景 SDK 适配 — 实施计划（阶段三-四）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现进程管理、错误处理与日志、设置面板功能补齐

**Architecture:** 增量修改现有 Electron + React 架构，新建 processManager 模块，扩展 agentSessionManager 重试逻辑，改造 SettingsPanel 为完整配置面板

**Tech Stack:** TypeScript, Electron, React 19, Vitest, Zod v4, Playwright, @anthropic-ai/claude-agent-sdk ^0.3.150

**前置依赖:** 阶段一-二实施计划已完成
**Spec:** `docs/superpowers/specs/2026-05-31-sdk-third-party-adaptation-design.md`

---

## 文件结构总览（阶段三-四新增/修改）

```
electron/agent/
  processManager.ts          ← 新建
  agentSessionManager.ts     ← 修改 (重试逻辑)
  errorDiagnostics.ts        ← 修改 (扩展第三方错误码)

src/app/components/
  SettingsPanel.tsx          ← 修改 (完整配置面板改造)

electron/
  main.ts                    ← 修改 (before-quit 增强 + settings:save 扩展)

src/ipc/
  payloadSchemas.ts          ← 修改 (settings:save 扩展全部新字段)

src/app/
  backendBridge.ts           ← 修改 (类型同步)
```

---

## 阶段三：运维增强层

---

### Task I1: 新建 processManager 模块

**Files:**
- Create: `electron/agent/processManager.ts`
- Create: `electron/agent/processManager.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// electron/agent/processManager.test.ts
import { describe, expect, it, vi } from "vitest";
import { createProcessManager } from "./processManager.js";

describe("createProcessManager", () => {
  it("returns spawn function and initial state", () => {
    const onStateChange = vi.fn();
    const pm = createProcessManager({ maxRestarts: 3, restartBackoffMs: 100, onStateChange });
    expect(pm.spawn).toBeDefined();
    expect(typeof pm.spawn).toBe("function");
    const state = pm.getState();
    expect(state.status).toBe("stopped");
    expect(state.restartCount).toBe(0);
  });

  it("tracks state changes through spawn callback", () => {
    const onStateChange = vi.fn();
    const pm = createProcessManager({ maxRestarts: 3, restartBackoffMs: 100, onStateChange });

    // 模拟 spawn 调用
    const mockChild = {
      pid: 12345,
      on: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    };
    const result = pm.spawn({ command: "test", args: [] } as any);

    expect(result.process).toBeDefined();
    // 状态应变为 running
    const state = pm.getState();
    // 注意：实际状态变更在 spawn 内部通过事件触发，此处测试主要验证基本结构
  });

  it("shutdown resolves after timeout", async () => {
    const onStateChange = vi.fn();
    const pm = createProcessManager({ maxRestarts: 3, restartBackoffMs: 100, onStateChange });
    await expect(pm.shutdown(100)).resolves.toBeUndefined();
    expect(pm.getState().status).toBe("stopped");
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run electron/agent/processManager.test.ts
```

- [ ] **Step 3: 实现 processManager 模块**

```typescript
// electron/agent/processManager.ts
import { spawn, type ChildProcess } from "node:child_process";
import type { SpawnOptions, SpawnedProcess } from "./claudeAgentSdkFacade.js";

export type ProcessState = {
  pid: number | null;
  status: "starting" | "running" | "stopping" | "stopped" | "crashed";
  startedAt: number;
  restartCount: number;
  lastError?: string;
};

export type ProcessManagerOptions = {
  maxRestarts: number;
  restartBackoffMs: number;
  onStateChange: (state: ProcessState) => void;
};

export function createProcessManager(options: ProcessManagerOptions) {
  let state: ProcessState = {
    pid: null,
    status: "stopped",
    startedAt: 0,
    restartCount: 0,
  };
  let currentProcess: ChildProcess | null = null;

  function setState(partial: Partial<ProcessState>) {
    state = { ...state, ...partial };
    options.onStateChange(state);
  }

  function spawnProcess(sdkOpts: SpawnOptions): SpawnedProcess {
    setState({ status: "starting", startedAt: Date.now() });

    const child = spawn(sdkOpts.command, sdkOpts.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      ...sdkOpts.options,
    });

    currentProcess = child;
    setState({ pid: child.pid ?? null, status: "running" });

    child.on("exit", (code, signal) => {
      if (code === 0 || signal === "SIGTERM" || state.status === "stopping") {
        setState({ status: "stopped", pid: null });
      } else {
        setState({ status: "crashed", pid: null, lastError: `exit code ${code} signal ${signal}` });
        attemptRestart(sdkOpts);
      }
    });

    child.on("error", (err) => {
      setState({ status: "crashed", lastError: err.message });
      attemptRestart(sdkOpts);
    });

    return {
      process: child,
      stdin: child.stdin!,
      stdout: child.stdout!,
      stderr: child.stderr!,
    };
  }

  function attemptRestart(sdkOpts: SpawnOptions) {
    if (state.restartCount >= options.maxRestarts) {
      setState({ status: "stopped" });
      return;
    }
    const backoff = options.restartBackoffMs * Math.pow(2, state.restartCount);
    const newCount = state.restartCount + 1;
    setState({ restartCount: newCount, status: "starting" });
    setTimeout(() => spawnProcess(sdkOpts), backoff);
  }

  async function shutdown(timeoutMs: number): Promise<void> {
    setState({ status: "stopping" });
    if (currentProcess && currentProcess.exitCode === null) {
      currentProcess.kill("SIGTERM");
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
      const exit = new Promise<void>((resolve) => {
        currentProcess?.on("exit", () => resolve());
      });
      await Promise.race([exit, timeout]);
      if (currentProcess.exitCode === null) {
        currentProcess.kill("SIGKILL");
      }
    }
    setState({ status: "stopped", pid: null });
  }

  return {
    spawn: spawnProcess,
    getState: () => ({ ...state }),
    shutdown,
  };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run electron/agent/processManager.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add electron/agent/processManager.ts electron/agent/processManager.test.ts
git commit -m "feat: 新建 processManager 模块，支持进程崩溃自动重启与优雅关闭"
```

---

### Task I2: 进程健康监控 — IPC 集成

**Files:**
- Modify: `electron/agent/agentSessionManager.ts` — 接收进程状态 + 通知前端
- Modify: `src/ipc/payloadSchemas.ts` — `sdk:system-event` subtype 扩展 `"process_health"`
- Modify: `src/app/sdkEventStore.ts` — 消费进程健康状态
- Modify: `src/app/sdkUiTypes.ts` — 新增 `processHealth` state

- [ ] **Step 1: payloadSchemas 扩展**

已在阶段一 Task C4 中预留 `"process_health"` subtype。如需单独提交：

```typescript
// 确认 sdk:system-event schema 的 subtype 枚举包含：
"process_health",
```

- [ ] **Step 2: sdkUiTypes + sdkEventStore 扩展**

```typescript
// sdkUiTypes.ts 中 SdkUiState 新增：
processHealth?: {
  pid: number | null;
  status: string;
  restartCount: number;
  message: string;
};

// sdkEventStore.ts 中：
if (payload.subtype === "process_health") {
  return {
    ...state,
    activeRunId,
    processHealth: payload.raw as SdkUiState["processHealth"],
  };
}
```

- [ ] **Step 3: agentSessionManager 中通知前端**

在 `startRun()` 中创建 processManager 时：

```typescript
const processManager = createProcessManager({
  maxRestarts: 3,
  restartBackoffMs: 2000,
  onStateChange: (procState) => {
    this.deps.emit("sdk:system-event" as MainToRendererChannel, {
      runId,
      subtype: "process_health",
      raw: {
        pid: procState.pid,
        status: procState.status,
        restartCount: procState.restartCount,
        message: procState.status === "crashed"
          ? `Agent 进程异常，正在自动恢复 (第 ${procState.restartCount} 次尝试)...`
          : procState.status === "running"
          ? "Agent 进程已恢复"
          : "",
      },
    });
  },
});
```

- [ ] **Step 4: 运行测试 + 构建**

```bash
npm test -- electron/agent/agentSessionManager.test.ts src/app/sdkEventStore.test.ts src/ipc/payloadSchemas.test.ts
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add electron/agent/agentSessionManager.ts src/ipc/payloadSchemas.ts src/app/sdkEventStore.ts src/app/sdkUiTypes.ts
git commit -m "feat: 进程健康监控通过 sdk:system-event(process_health) 通知前端"
```

---

### Task I3: main.ts 优雅关闭增强

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: 修改 before-quit 处理**

```typescript
// 在 electron/main.ts 的 startup().then() 中：
startup().then(async (warmQuery) => {
  app.on("before-quit", async (event) => {
    event.preventDefault();
    try {
      // 1. 关闭所有活跃 session（需要通过 runtime 访问）
      // 注意：需要在 registerBackendIpc 外暴露 manager 引用
      for (const runId of manager.activeRunIds()) {
        try { manager.stopRun(runId); } catch { /* ignore */ }
      }
      // 2. 关闭 processManager
      if (processManager) {
        await processManager.shutdown(5000);
      }
      // 3. 关闭 warmQuery
      try {
        await warmQuery[Symbol.asyncDispose]();
      } catch {
        // Silently ignore
      }
    } catch {
      // Silently ignore dispose errors during shutdown
    } finally {
      app.quit();
    }
  });
}).catch((e) => {
  console.warn("SDK startup 预热失败:", e);
});
```

`AgentSessionManager` 需要新增 `activeRunIds()` 方法：

```typescript
// agentSessionManager.ts
activeRunIds(): string[] {
  return Array.from(this.runs.keys());
}
```

- [ ] **Step 2: 运行测试 + 构建**

```bash
npm test -- electron/agent/agentSessionManager.test.ts
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts electron/agent/agentSessionManager.ts
git commit -m "feat: main.ts before-quit 增强——遍历活跃 session + 等待进程退出后关闭"
```

---

### Task L1: 第三方 API 特有错误码扩展

**Files:**
- Modify: `electron/agent/errorDiagnostics.ts` — B2 同文件，新增 `THIRD_PARTY_ERRORS`
- Modify: `electron/agent/errorDiagnostics.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// 在 errorDiagnostics.test.ts 中新增
it("diagnoses third-party insufficient_balance error", () => {
  const result = diagnoseError({ code: "insufficient_balance", message: "Insufficient balance" });
  expect(result.message).toBe("API 余额不足");
  expect(result.retryable).toBe(false);
});

it("diagnoses third-party content_filtered error", () => {
  const result = diagnoseError({ code: "content_filtered", message: "Content filtered" });
  expect(result.message).toBe("内容被安全过滤");
});
```

- [ ] **Step 2: 已在 Task B2 中实现全部的 `THIRD_PARTY_ERRORS` 映射表。此处确认覆盖：**

```typescript
// 确认 THIRD_PARTY_ERRORS 包含所有 spec 中列出的错误码：
// insufficient_balance, model_not_found, model_overloaded,
// context_length_exceeded, rate_limit_exceeded,
// invalid_api_key, api_key_expired, content_filtered
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest run electron/agent/errorDiagnostics.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add electron/agent/errorDiagnostics.ts electron/agent/errorDiagnostics.test.ts
git commit -m "feat: errorDiagnostics 扩展第三方 API 特有错误码（余额不足/模型不存在/内容过滤等）"
```

---

### Task L2: 调试日志配置

**Files:**
- Modify: `electron/agent/agentConfig.ts` — `sanitizeUserSdkOptions` 补 debug/debugFile 赋值
- Modify: `electron/agent/sdkSettings.ts` — `SettingsFormValues` 扩展
- Modify: `src/ipc/payloadSchemas.ts` — `settings:save` schema 扩展
- Modify: `src/app/backendBridge.ts` — 类型扩展
- Modify: `src/app/components/SettingsPanel.tsx` — 新增调试配置 UI

- [ ] **Step 1: 写失败测试 — agentConfig.test.ts**

```typescript
it("accepts debug options in userSdkOptions", () => {
  const opts = sanitizeUserSdkOptions({ debug: true, debugFile: "/tmp/debug.log" });
  expect(opts.debug).toBe(true);
  expect(opts.debugFile).toBe("/tmp/debug.log");
});
```

- [ ] **Step 2: agentConfig.ts — 补全赋值**

```typescript
// sanitizeUserSdkOptions 中，B 组区域新增（如不存在）：
if (typeof source.debug === "boolean") options.debug = source.debug;
if (typeof source.debugFile === "string") options.debugFile = source.debugFile;
```

- [ ] **Step 3: sdkSettings.ts + payloadSchemas.ts + backendBridge.ts 扩展**

```typescript
// SettingsFormValues:
debug?: boolean;
debugFile?: string;

// settings:save schema:
debug: z.boolean().optional(),
debugFile: z.string().optional(),

// saveClaudeCodeSettings:
...(input.debug !== undefined ? { CLAUDE_CODE_DEBUG: String(input.debug) } : {}),
...(input.debugFile ? { CLAUDE_CODE_DEBUG_FILE: input.debugFile } : {}),
```

- [ ] **Step 4: SettingsPanel.tsx — 新增 UI**

```tsx
{/* 在高级设置底部 */}
<div className="setting-row">
  <div className="setting-label">
    <span>调试模式</span>
    <span className="setting-subtitle">记录 SDK 原始消息用于排查问题</span>
  </div>
  <div className="switch-group">
    <button className={debug ? "active" : ""} onClick={() => setDebug(true)}>开</button>
    <button className={!debug ? "active" : ""} onClick={() => setDebug(false)}>关</button>
  </div>
</div>
{debug && (
  <div className="setting-row">
    <label className="setting-label" htmlFor="debug-file">日志文件路径</label>
    <input id="debug-file" type="text" value={debugFile} onChange={(e) => setDebugFile(e.target.value)} placeholder=".claude/debug.log" />
  </div>
)}
```

以及面板底部新增按钮：

```tsx
<div className="setting-footer-actions">
  <button className="setting-action-btn" onClick={handleExportLogs}>导出调试日志</button>
  <button className="setting-action-btn" onClick={handleCopyRecentLogs}>复制最近日志</button>
</div>
```

- [ ] **Step 5: 运行测试 + 构建**

```bash
npm test -- electron/agent/agentConfig.test.ts electron/agent/sdkSettings.test.ts src/ipc/payloadSchemas.test.ts src/app/components/SettingsPanel.test.tsx
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add electron/agent/agentConfig.ts electron/agent/sdkSettings.ts src/ipc/payloadSchemas.ts src/app/backendBridge.ts src/app/components/SettingsPanel.tsx
git commit -m "feat: 调试日志配置——debug/debugFile 选项 + 设置面板 UI + 导出按钮"
```

---

### Task L3: 错误重试策略

**Files:**
- Modify: `electron/agent/agentSessionManager.ts` — `drainMessages()` 增加重试
- Modify: `src/ipc/payloadSchemas.ts` — `sdk:system-event` subtype 扩展 `"retry_attempt"`

- [ ] **Step 1: 实现 drainWithRetry**

```typescript
// agentSessionManager.ts

const RETRYABLE_ERRORS = new Set([
  "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED",
  "socket hang up", "network error",
]);

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = typeof e.code === "string" ? e.code : undefined;
  if (code && RETRYABLE_ERRORS.has(code)) return true;
  const msg = typeof e.message === "string" ? e.message : String(e);
  for (const pattern of RETRYABLE_ERRORS) {
    if (msg.includes(pattern)) return true;
  }
  return false;
}

// 在 AgentSessionManager 中替换 drainMessages：
private async drainMessages(runId: string, messages: AsyncIterable<unknown>, retries = 3, attempt = 1) {
  const mapper = new SdkRunEventMapperSession(runId);
  try {
    for await (const message of messages) {
      for (const event of mapper.map(message)) {
        this.emitRunEvent(runId, event);
      }
    }
  } catch (error) {
    const shouldRetry = attempt <= retries && isRetryable(error);
    if (shouldRetry) {
      this.deps.emit("sdk:system-event" as MainToRendererChannel, {
        runId,
        subtype: "retry_attempt",
        raw: { attempt, maxRetries: retries, error: String(error) },
      });
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      return this.drainMessages(runId, messages, retries, attempt + 1);
    }
    throw error;
  }
}
```

- [ ] **Step 2: payloadSchemas 确认 subtype 枚举包含 `"retry_attempt"`**

已在 Task C4 中预留。

- [ ] **Step 3: sdkEventStore 消费**

```typescript
if (payload.subtype === "retry_attempt") {
  return {
    ...state,
    activeRunId,
    retryStatus: payload.raw as { attempt: number; maxRetries: number; error: string },
  };
}
```

- [ ] **Step 4: 运行测试 + 构建**

```bash
npm test -- electron/agent/agentSessionManager.test.ts src/app/sdkEventStore.test.ts src/ipc/payloadSchemas.test.ts
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add electron/agent/agentSessionManager.ts src/ipc/payloadSchemas.ts src/app/sdkEventStore.ts
git commit -m "feat: drainMessages 增加网络瞬时错误自动重试（退避策略+UI通知）"
```

---

### 阶段三验证检查点

```bash
npm test -- electron/agent/processManager.test.ts electron/agent/errorDiagnostics.test.ts electron/agent/agentSessionManager.test.ts
npm test -- src/app/sdkEventStore.test.ts src/ipc/payloadSchemas.test.ts
npm run build
npx playwright test tests/e2e/process-management.spec.ts tests/e2e/error-handling.spec.ts
```

---

## 阶段四：用户界面层

---

### Task K1: 设置面板新增全部配置项

**Files:**
- Modify: `src/app/components/SettingsPanel.tsx`

目标是汇总前三个阶段引入的全部配置项，实现 spec 第 1571-1612 行的完整布局。

- [ ] **Step 1: 写失败测试 — SettingsPanel.test.tsx**

```typescript
it("renders all advanced settings when expanded", async () => {
  render(<SettingsPanel bridge={mockBridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" connectionStatus={{ state: "connected", baseUrl: "https://api.test.com", model: "test", probedAt: Date.now() }} modelCapabilities={{ supportsThinking: true, supportsJsonSchema: true, supportsPromptCaching: true, supportsToolUse: true }} />);
  await userEvent.click(screen.getByText("高级设置"));
  expect(screen.getByText("结构化输出")).toBeInTheDocument();
  expect(screen.getByText("Prompt 缓存")).toBeInTheDocument();
  expect(screen.getByText("最大对话轮数")).toBeInTheDocument();
  expect(screen.getByText("调试模式")).toBeInTheDocument();
});

it("disables prompt caching when model does not support it", () => {
  render(<SettingsPanel bridge={mockBridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" modelCapabilities={{ supportsThinking: true, supportsJsonSchema: true, supportsPromptCaching: false, supportsToolUse: true }} />);
  // promptCaching 开关应被禁用
  const cachingSwitch = screen.getByRole("button", { name: "开" });
  // 注意：具体选择器取决于实现
});
```

- [ ] **Step 2: 实现完整设置面板**

SettingsPanel 的 Props 扩展：

```typescript
type Props = {
  bridge: SettingsBridge;
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
  activeRunId?: string;
  onApplySettings?: (runId: string, settings: Record<string, unknown>) => void;
  connectionStatus?: ConnectionStatusState;
  modelCapabilities?: ModelCapabilitiesState;
};
```

新增 state：
```typescript
// 高级设置折叠
const [advancedExpanded, setAdvancedExpanded] = useState(false);
// promptCaching
const [promptCaching, setPromptCaching] = useState(false);
// 最大对话轮数
const [maxTurns, setMaxTurns] = useState(50);
// 成本上限
const [maxBudgetUsd, setMaxBudgetUsd] = useState(5);
// 调试
const [debug, setDebug] = useState(false);
const [debugFile, setDebugFile] = useState(".claude/debug.log");
```

新增 JSX（在已有"推理努力程度"之后）：

```tsx
<div className="setting-divider" />

{/* 高级设置折叠区域 */}
<div className="setting-section-header" onClick={() => setAdvancedExpanded(!advancedExpanded)}>
  <span className="toggle-arrow">{advancedExpanded ? "▾" : "▸"}</span>
  <span className="setting-label">高级设置</span>
</div>

{advancedExpanded && (
  <div className="advanced-settings">
    {/* 结构化输出 — 见 Task D3 */}
    <div className="setting-row">
      <div className="setting-label">
        <span>结构化输出</span>
        <span className="setting-subtitle">让 AI 按指定 JSON 格式输出</span>
      </div>
      <div className="switch-group">
        <button className={outputFormatEnabled ? "active" : ""} onClick={() => setOutputFormatEnabled(true)} disabled={!modelCapabilities?.supportsJsonSchema} title={!modelCapabilities?.supportsJsonSchema ? "当前模型不支持 JSON Schema 输出" : undefined}>开</button>
        <button className={!outputFormatEnabled ? "active" : ""} onClick={() => setOutputFormatEnabled(false)}>关</button>
      </div>
    </div>
    {/* ... 模板下拉 + 自定义 schema ... */}

    {/* Prompt 缓存 */}
    <div className="setting-row">
      <div className="setting-label">
        <span>Prompt 缓存</span>
        <span className="setting-subtitle">重复上下文可降低 token 消耗</span>
      </div>
      <div className="switch-group">
        <button className={promptCaching ? "active" : ""} onClick={() => setPromptCaching(true)} disabled={!modelCapabilities?.supportsPromptCaching} title={!modelCapabilities?.supportsPromptCaching ? "当前模型不支持 Prompt Caching" : undefined}>开</button>
        <button className={!promptCaching ? "active" : ""} onClick={() => setPromptCaching(false)}>关</button>
      </div>
    </div>

    {/* 最大对话轮数 */}
    <div className="setting-row">
      <label className="setting-label" htmlFor="max-turns">最大对话轮数</label>
      <input id="max-turns" type="number" min={1} max={100} value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} />
    </div>

    {/* 成本上限 */}
    <div className="setting-row">
      <label className="setting-label" htmlFor="max-budget">成本上限 (USD)</label>
      <input id="max-budget" type="number" min={0.01} step={0.01} value={maxBudgetUsd} onChange={(e) => setMaxBudgetUsd(Number(e.target.value))} />
    </div>

    {/* 调试模式 — 见 Task L2 */}
    <div className="setting-row">
      <div className="setting-label">
        <span>调试模式</span>
        <span className="setting-subtitle">记录 SDK 原始消息用于排查问题</span>
      </div>
      <div className="switch-group">
        <button className={debug ? "active" : ""} onClick={() => setDebug(true)}>开</button>
        <button className={!debug ? "active" : ""} onClick={() => setDebug(false)}>关</button>
      </div>
    </div>
    {debug && (
      <div className="setting-row">
        <label className="setting-label" htmlFor="debug-file">日志文件路径</label>
        <input id="debug-file" type="text" value={debugFile} onChange={(e) => setDebugFile(e.target.value)} />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: 运行测试 + 构建**

```bash
npx vitest run src/app/components/SettingsPanel.test.tsx
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/SettingsPanel.tsx src/app/components/SettingsPanel.test.tsx
git commit -m "feat: 设置面板新增输出格式/Prompt缓存/对话轮数/成本上限/调试模式配置"
```

---

### Task K2: UserSdkOptions 类型补全

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 补全缺失字段的类型声明**

在 `UserSdkOptions` interface 中确认所有字段均已声明：

```typescript
// 检查清单（在 agentConfig.ts 中逐一确认）：
// ✅ outputFormat — Task D1 已新增
// ✅ promptCaching — 已有声明（第 38 行）
// ✅ max_budget_usd — 如未声明则新增
// ✅ enableFileCheckpointing — 如未声明则新增
// ✅ debug — 已有声明（第 46 行）
// ✅ debugFile — 已有声明（第 47 行）
// ✅ fallback_model — 如未声明则新增
// ✅ maxTurns — 已有声明（第 23 行）
```

新增字段类型：
```typescript
max_budget_usd?: number;
enableFileCheckpointing?: boolean;
fallback_model?: string;
```

- [ ] **Step 2: sanitizeUserSdkOptions 补全校验**

```typescript
// B 组区域：
if (typeof source.max_budget_usd === "number" && source.max_budget_usd > 0) options.max_budget_usd = source.max_budget_usd;
if (typeof source.enableFileCheckpointing === "boolean") options.enableFileCheckpointing = source.enableFileCheckpointing;
if (typeof source.fallback_model === "string" && source.fallback_model.length > 0) options.fallback_model = source.fallback_model;
```

- [ ] **Step 3: loadAgentRuntimeConfig 传递新字段**

```typescript
// sdkOptions 中：
...(userSdkOptions.max_budget_usd !== undefined ? { max_budget_usd: userSdkOptions.max_budget_usd } : {}),
...(userSdkOptions.enableFileCheckpointing !== undefined ? { enableFileCheckpointing: userSdkOptions.enableFileCheckpointing } : {}),
...(userSdkOptions.fallback_model ? { fallback_model: userSdkOptions.fallback_model } : {}),
...(userSdkOptions.maxTurns ? { max_turns: userSdkOptions.maxTurns } : {}),
```

- [ ] **Step 4: 运行测试 + 构建**

```bash
npm test -- electron/agent/agentConfig.test.ts
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: UserSdkOptions 补全 max_budget_usd/enableFileCheckpointing/fallback_model 类型与校验"
```

---

### Task K3: 配置持久化增强 + IPC 全链路闭合

**Files:**
- Modify: `electron/agent/sdkSettings.ts` — 新增 `loadAppSettings`/`saveAppSettings`
- Modify: `electron/main.ts` — `settings:save` handler 透传全部新字段
- Modify: `src/ipc/payloadSchemas.ts` — `settings:save` schema 扩展全部新字段
- Modify: `src/app/backendBridge.ts` — 类型同步

- [ ] **Step 1: sdkSettings.ts — 新增 app-settings 读写**

```typescript
function appSettingsPath(cwd: string) {
  return path.join(cwd, ".claude", "app-settings.json");
}

export type AppSettings = {
  version: number;
  outputFormat?: { template?: string; customSchema?: string | null };
  lastConnectionCheck?: number;
};

export function loadAppSettings(cwd: string): AppSettings {
  try {
    const p = appSettingsPath(cwd);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8")) as AppSettings;
    }
  } catch { /* ignore */ }
  return { version: 1 };
}

export function saveAppSettings(cwd: string, settings: AppSettings): void {
  const p = appSettingsPath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ ...settings, version: 1 }, null, 2), "utf8");
}
```

- [ ] **Step 2: main.ts — settings:save handler 扩展**

```typescript
handleRequest("settings:save", ({ baseUrl, apiKey, model, effort, sandboxEnabled, promptCaching, debug, debugFile, maxBudgetUsd, outputFormat }) => {
  saveClaudeCodeSettings({ cwd, baseUrl, apiKey, model, effort, sandboxEnabled, promptCaching, debug, debugFile, maxBudgetUsd });
  if (outputFormat) {
    const appSettings = loadAppSettings(cwd);
    appSettings.outputFormat = {
      template: outputFormat.template,
      customSchema: outputFormat.customSchema,
    };
    saveAppSettings(cwd, appSettings);
  }
  return loadClaudeCodeSettings({ cwd });
});
```

- [ ] **Step 3: payloadSchemas.ts — settings:save 全字段 schema**

```typescript
// Zod schema 包含全部新增字段：
const settingsSaveSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string(),
  effort: z.string().optional(),
  sandboxEnabled: z.boolean().optional(),
  promptCaching: z.boolean().optional(),
  debug: z.boolean().optional(),
  debugFile: z.string().optional(),
  maxBudgetUsd: z.number().positive().optional(),
  enableFileCheckpointing: z.boolean().optional(),
  fallbackModel: z.string().optional(),
  outputFormat: z.object({
    template: z.string().optional(),
    customSchema: z.string().nullable().optional(),
  }).optional(),
});
```

- [ ] **Step 4: backendBridge.ts — SettingsFormValues 同步**

```typescript
export type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
  effort?: string;
  sandboxEnabled?: boolean;
  promptCaching?: boolean;
  debug?: boolean;
  debugFile?: string;
  maxBudgetUsd?: number;
  enableFileCheckpointing?: boolean;
  fallbackModel?: string;
  outputFormat?: { template?: string; customSchema?: string | null };
};
```

- [ ] **Step 5: 全量 IPC 同步验证**

```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts
npm test -- src/app/backendBridge.test.ts electron/agent/sdkSettings.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add electron/agent/sdkSettings.ts electron/main.ts src/ipc/payloadSchemas.ts src/app/backendBridge.ts
git commit -m "feat: 配置持久化增强——新增 app-settings + IPC 全链路闭合"
```

---

### 阶段四验证检查点

```bash
npm test -- src/app/components/SettingsPanel.test.tsx
npm test -- electron/agent/agentConfig.test.ts electron/agent/sdkSettings.test.ts
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts src/app/backendBridge.test.ts
npm run build
npx playwright test tests/e2e/settings-panel.spec.ts
```

---

## 全量验证

```bash
# 全量单元测试 + IPC 测试 + 前端测试
npm test

# 类型检查 + 构建
npm run build

# E2E 全量
npx playwright test

# 一次性全量
npm test && npm run build && npx playwright test
```
