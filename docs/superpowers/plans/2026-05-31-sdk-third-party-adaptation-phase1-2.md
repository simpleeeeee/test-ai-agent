# 第三方 API 场景 SDK 适配 — 实施计划（阶段一-二）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现连接验证、错误诊断、模型能力检测与降级、第三方 API 兼容、结构化输出、Prompt Caching、动态提示边界、自定义工具

**Architecture:** 增量修改现有 Electron + React 架构，新建独立模块（connectionProbe / errorDiagnostics / modelCapabilities / systemPromptBuilder / customTools / appMcpServer），扩展现有 IPC 通道和设置面板

**Tech Stack:** TypeScript, Electron, React 19, Vitest, Zod v4, Playwright, @anthropic-ai/claude-agent-sdk ^0.3.150

**Spec:** `docs/superpowers/specs/2026-05-31-sdk-third-party-adaptation-design.md`

---

## 文件结构总览（阶段一-二新增/修改）

```
electron/agent/
  connectionProbe.ts          ← 新建
  errorDiagnostics.ts         ← 新建
  modelCapabilities.ts        ← 新建
  systemPromptBuilder.ts      ← 新建
  customTools.ts              ← 新建
  appMcpServer.ts             ← 新建
  agentConfig.ts              ← 修改 (多次)
  agentSessionManager.ts      ← 修改 (多次)
  runEventMapper.ts           ← 修改
  sdkSettings.ts              ← 修改

src/ipc/
  channels.ts                 ← 修改
  payloadSchemas.ts           ← 修改 (多次)

src/app/
  backendBridge.ts            ← 修改 (多次)
  sdkEventStore.ts            ← 修改 (多次)
  sdkUiTypes.ts               ← 修改 (多次)

src/domain/
  outputSchemas.ts            ← 新建

electron/
  main.ts                     ← 修改 (多次)
```

---

## 阶段一：基础设施层

---

### Task B1-1: 新建 connectionProbe 模块（类型 + 骨架）

**Files:**
- Create: `electron/agent/connectionProbe.ts`
- Create: `electron/agent/connectionProbe.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// electron/agent/connectionProbe.test.ts
import { describe, expect, it, vi } from "vitest";
import { probeConnection, type ConnectionStatus } from "./connectionProbe.js";

describe("probeConnection", () => {
  it("returns connected status when probe succeeds", async () => {
    const warmQuery = {
      query: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => {
          let done = false;
          return {
            next: () => {
              if (done) return Promise.resolve({ done: true, value: undefined });
              done = true;
              return Promise.resolve({
                done: false,
                value: { type: "result", subtype: "success" },
              });
            },
          };
        },
        close: vi.fn(),
      }),
    };

    const result = await probeConnection(warmQuery as any, {
      baseUrl: "https://api.example.com",
      model: "test-model",
    });

    expect(result.state).toBe("connected");
    expect(result.baseUrl).toBe("https://api.example.com");
    expect(result.model).toBe("test-model");
  });

  it("returns failed status and error info when probe throws", async () => {
    const warmQuery = {
      query: vi.fn().mockImplementation(() => {
        const err = new Error("connect ENOTFOUND api.invalid.example.com");
        (err as any).code = "ENOTFOUND";
        throw err;
      }),
    };

    const result = await probeConnection(warmQuery as any, {
      baseUrl: "https://api.invalid.example.com",
      model: "test-model",
    });

    expect(result.state).toBe("failed");
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe("ENOTFOUND");
  });

  it("returns failed status on timeout", async () => {
    const warmQuery = {
      query: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise(() => {}), // 永远不 resolve
        }),
        close: vi.fn(),
      }),
    };

    const result = await probeConnection(warmQuery as any, {
      baseUrl: "https://slow.example.com",
      model: "test-model",
      timeoutMs: 100,
    });

    expect(result.state).toBe("failed");
    expect(result.error!.code).toBe("TIMEOUT");
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run electron/agent/connectionProbe.test.ts
```
预期：全部 FAIL（模块不存在）

- [ ] **Step 3: 实现最小 connectionProbe**

```typescript
// electron/agent/connectionProbe.ts

export type ConnectionState = "connected" | "unverified" | "connecting" | "failed";

export type ConnectionStatus = {
  state: ConnectionState;
  baseUrl: string;
  model: string;
  error?: {
    code: string;
    message: string;
    suggestion: string;
  };
  probedAt: number;
};

type ProbeOptions = {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
};

export async function probeConnection(
  warmQuery: { query: (...args: any[]) => any },
  options: ProbeOptions,
): Promise<ConnectionStatus> {
  const { baseUrl, model, timeoutMs = 10000 } = options;

  try {
    const q = warmQuery.query({
      prompt: [{ type: "user", message: { role: "user", content: "ping" } }] as any,
      options: { max_turns: 1, includePartialMessages: false } as any,
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("Connection probe timed out"), { code: "TIMEOUT" })), timeoutMs),
    );

    await Promise.race([
      (async () => {
        for await (const _msg of q) {
          // 消费消息流，不关心内容
        }
      })(),
      timeout,
    ]);

    return {
      state: "connected",
      baseUrl,
      model,
      probedAt: Date.now(),
    };
  } catch (error: any) {
    const code = error?.code ?? (error?.message?.includes("401") ? "401" : "UNKNOWN");
    const diagnostic = basicDiagnose(code, error?.message ?? String(error));
    return {
      state: "failed",
      baseUrl,
      model,
      error: diagnostic,
      probedAt: Date.now(),
    };
  }
}

function basicDiagnose(code: string, rawMessage: string): ConnectionStatus["error"] {
  const map: Record<string, { message: string; suggestion: string }> = {
    ENOTFOUND: { message: "无法解析 API 地址", suggestion: "请检查 Base URL 是否正确，确保不包含拼写错误" },
    ECONNREFUSED: { message: "API 服务拒绝连接", suggestion: "请确认 Base URL 的端口和协议 (http/https) 是否正确" },
    ETIMEDOUT: { message: "API 请求超时", suggestion: "请检查网络连接或 API 服务是否响应正常" },
    TIMEOUT: { message: "连接探测超时", suggestion: "请检查网络连接或 API 服务是否响应正常" },
    ECONNRESET: { message: "连接被重置", suggestion: "网络波动导致，可重试" },
    "401": { message: "API Key 无效或已过期", suggestion: "请在设置中更新 API Key" },
    "403": { message: "无访问权限", suggestion: "请确认 API Key 是否有权访问该模型" },
  };
  const entry = map[code];
  if (entry) return { code, ...entry };
  return { code: "UNKNOWN", message: `未知连接错误：${rawMessage.slice(0, 100)}`, suggestion: "请检查 Base URL 和 API Key 配置是否正确" };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run electron/agent/connectionProbe.test.ts
```
预期：3 PASS

- [ ] **Step 5: Commit**

```bash
git add electron/agent/connectionProbe.ts electron/agent/connectionProbe.test.ts
git commit -m "feat: 新建 connectionProbe 模块，支持 API 连通性探测与中文化错误诊断"
```

---

### Task B1-2: 新增 sdk:connection-status IPC 通道

**Files:**
- Modify: `src/ipc/channels.ts`
- Modify: `src/ipc/payloadSchemas.ts`
- Modify: `src/ipc/channels.test.ts`
- Modify: `src/ipc/payloadSchemas.test.ts`

- [ ] **Step 1: 写失败测试 — channels.test.ts**

```typescript
// 在 src/ipc/channels.test.ts 中新增
it("includes sdk:connection-status in mainToRendererChannels", () => {
  expect(mainToRendererChannels).toContain("sdk:connection-status");
});
```

- [ ] **Step 2: 写失败测试 — payloadSchemas.test.ts**

```typescript
// 在 src/ipc/payloadSchemas.test.ts 中新增
import { describe, expect, it } from "vitest";

describe("sdk:connection-status payload", () => {
  it("accepts valid connected status", () => {
    const payload = {
      state: "connected",
      baseUrl: "https://api.example.com",
      model: "test-model",
      probedAt: Date.now(),
    };
    expect(() => parseMainToRendererPayload("sdk:connection-status", payload)).not.toThrow();
  });

  it("accepts valid failed status with error", () => {
    const payload = {
      state: "failed",
      baseUrl: "https://api.example.com",
      model: "test-model",
      error: { code: "ENOTFOUND", message: "无法解析 API 地址", suggestion: "请检查 Base URL" },
      probedAt: Date.now(),
    };
    expect(() => parseMainToRendererPayload("sdk:connection-status", payload)).not.toThrow();
  });

  it("rejects invalid state", () => {
    const payload = { state: "invalid", baseUrl: "https://api.example.com", model: "test-model", probedAt: Date.now() };
    expect(() => parseMainToRendererPayload("sdk:connection-status", payload)).toThrow();
  });
});
```

- [ ] **Step 3: 运行测试验证失败**

```bash
npx vitest run src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts
```
预期：新增测试 FAIL

- [ ] **Step 4: 实现 — channels.ts**

在 `mainToRendererChannels` 数组中新增 `"sdk:connection-status"`：

```typescript
// 在 src/ipc/channels.ts 的 mainToRendererChannels 中新增（按字母序插入）
"sdk:compact-boundary",
"sdk:connection-status",  // ← 新增
"sdk:deferred-tool-use",
```

- [ ] **Step 5: 实现 — payloadSchemas.ts**

```typescript
// 在 src/ipc/payloadSchemas.ts 中新增 schema
import { z } from "zod/v4";

const connectionStatusErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  suggestion: z.string(),
});

const connectionStatusSchema = z.object({
  state: z.enum(["connected", "unverified", "connecting", "failed"]),
  baseUrl: z.string(),
  model: z.string(),
  error: connectionStatusErrorSchema.optional(),
  probedAt: z.number(),
});

// 在 mainToRendererPayloadSchemas 映射中新增
"sdk:connection-status": connectionStatusSchema,
```

- [ ] **Step 6: 运行测试验证通过**

```bash
npx vitest run src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts
```
预期：新增测试 PASS

- [ ] **Step 7: Commit**

```bash
git add src/ipc/channels.ts src/ipc/payloadSchemas.ts src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts
git commit -m "feat: 新增 sdk:connection-status IPC 通道及 Zod schema"
```

---

### Task B1-3: 在 main.ts 中集成连接探测

**Files:**
- Modify: `electron/main.ts`
- Modify: `src/app/backendBridge.ts`

- [ ] **Step 1: 修改 main.ts — 在 startup().then() 中调用探测**

在 `electron/main.ts` 的 `startup().then()` 块中：

```typescript
// 替换现有的 startup().then() 块
startup().then(async (warmQuery) => {
  // 原有 before-quit 逻辑
  app.on("before-quit", async (event) => {
    event.preventDefault();
    try {
      await warmQuery[Symbol.asyncDispose]();
    } catch {
      // Silently ignore dispose errors during shutdown
    }
  });

  // === 新增：连接探测 ===
  const settings = loadClaudeCodeSettings({ cwd });
  import("./agent/connectionProbe.js").then(({ probeConnection }) => {
    probeConnection(warmQuery, {
      baseUrl: settings.baseUrl,
      model: settings.model,
    }).then((status) => {
      // 通过 IPC 推送到所有窗口
      for (const win of BrowserWindow.getAllWindows()) {
        sendToRenderer(win, "sdk:connection-status", status);
      }
    }).catch((err) => {
      console.warn("Connection probe failed:", err);
    });
  });
}).catch((e) => {
  console.warn("SDK startup 预热失败:", e);
});
```

- [ ] **Step 2: 修改 backendBridge.ts — streamChannels 新增通道**

```typescript
// 在 src/app/backendBridge.ts 的 streamChannels 数组中新增
"sdk:compact-boundary",
"sdk:connection-status",  // ← 新增
"sdk:deferred-tool-use",
```

- [ ] **Step 3: 构建验证**

```bash
npm run build
```
预期：无类型错误

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts src/app/backendBridge.ts
git commit -m "feat: main.ts 集成连接探测，startup 后自动验证 API 连通性"
```

---

### Task B2: 新建 errorDiagnostics 模块

**Files:**
- Create: `electron/agent/errorDiagnostics.ts`
- Create: `electron/agent/errorDiagnostics.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// electron/agent/errorDiagnostics.test.ts
import { describe, expect, it } from "vitest";
import { diagnoseError, NETWORK_ERRORS, THIRD_PARTY_ERRORS } from "./errorDiagnostics.js";

describe("NETWORK_ERRORS", () => {
  it("has Chinese messages for all entries", () => {
    for (const [code, diag] of Object.entries(NETWORK_ERRORS)) {
      expect(diag.message, `${code}: message should be non-empty`).toBeTruthy();
      expect(diag.message, `${code}: message should contain Chinese`).toMatch(/[一-鿿]/);
      expect(diag.suggestion, `${code}: suggestion should be non-empty`).toBeTruthy();
      expect(typeof diag.retryable, `${code}: retryable should be boolean`).toBe("boolean");
    }
  });
});

describe("diagnoseError", () => {
  it("returns known error for matching code", () => {
    const result = diagnoseError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND" });
    expect(result.message).toBe("无法解析 API 地址");
    expect(result.retryable).toBe(true);
  });

  it("returns known error for HTTP 401", () => {
    const result = diagnoseError({ message: "Request failed with status code 401" });
    expect(result.message).toBe("API Key 无效或已过期");
  });

  it("returns third-party error for model_not_found", () => {
    const result = diagnoseError({ code: "model_not_found", message: "Model deepseek-v4 not found" });
    expect(result.message).toBe("模型不可用");
  });

  it("returns generic Chinese message for unknown error", () => {
    const result = diagnoseError({ code: "SOME_NEW_ERROR", message: "Something happened" });
    expect(result.message).toMatch(/[一-鿿]/);
    expect(result.message).not.toContain("Something happened"); // 不暴露原始英文
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run electron/agent/errorDiagnostics.test.ts
```

- [ ] **Step 3: 实现 errorDiagnostics 模块**

```typescript
// electron/agent/errorDiagnostics.ts

export type ErrorDiagnostic = {
  message: string;
  suggestion: string;
  retryable: boolean;
};

export const NETWORK_ERRORS: Record<string, ErrorDiagnostic> = {
  ENOTFOUND:     { message: "无法解析 API 地址",    suggestion: "请检查 Base URL 是否正确，确保不包含拼写错误", retryable: true },
  ECONNREFUSED:  { message: "API 服务拒绝连接",     suggestion: "请确认 Base URL 的端口和协议 (http/https) 是否正确", retryable: true },
  ETIMEDOUT:     { message: "API 请求超时",         suggestion: "请检查网络连接或 API 服务是否响应正常", retryable: true },
  TIMEOUT:       { message: "连接探测超时",         suggestion: "请检查网络连接或 API 服务是否响应正常", retryable: true },
  ECONNRESET:    { message: "连接被重置",           suggestion: "网络波动导致，可重试。如持续出现请联系 API 提供商", retryable: true },
  "401":         { message: "API Key 无效或已过期",  suggestion: "请在设置中更新 API Key", retryable: false },
  "403":         { message: "无访问权限",           suggestion: "请确认 API Key 是否有权访问该模型，或检查 API 套餐权限", retryable: false },
  "429":         { message: "请求频率过高，已被限流", suggestion: "请稍后重试，或联系 API 提供商升级套餐", retryable: true },
  "500":         { message: "API 服务端错误",       suggestion: "第三方 API 暂时不可用，请稍后重试", retryable: true },
  "502":         { message: "API 网关错误",         suggestion: "第三方 API 网关暂时异常，请稍后重试", retryable: true },
  "503":         { message: "API 服务暂不可用",     suggestion: "第三方 API 正在维护或过载，请稍后重试", retryable: true },
};

export const THIRD_PARTY_ERRORS: Record<string, ErrorDiagnostic> = {
  "insufficient_balance":    { message: "API 余额不足", suggestion: "请联系第三方 API 提供商充值", retryable: false },
  "model_not_found":         { message: "模型不可用", suggestion: "请检查模型名称是否正确，或确认 API 套餐是否包含该模型", retryable: false },
  "model_overloaded":        { message: "模型负载过高", suggestion: "当前模型请求量过大，请稍后重试或切换模型", retryable: true },
  "context_length_exceeded": { message: "上下文超过模型限制", suggestion: "请缩短会话、清空对话或开启 Compaction", retryable: false },
  "rate_limit_exceeded":     { message: "请求频率超限", suggestion: "请稍后重试，或联系提供商提升 RPM/TPM 配额", retryable: true },
  "invalid_api_key":         { message: "API Key 无效", suggestion: "请检查 Key 是否正确，是否已过期或被吊销", retryable: false },
  "api_key_expired":         { message: "API Key 已过期", suggestion: "请联系提供商续期或生成新的 API Key", retryable: false },
  "content_filtered":        { message: "内容被安全过滤", suggestion: "输入或输出触发了 API 的内容安全策略，请调整措辞", retryable: false },
};

const ALL_ERRORS: Record<string, ErrorDiagnostic> = {
  ...NETWORK_ERRORS,
  ...THIRD_PARTY_ERRORS,
};

export function diagnoseError(raw: unknown): ErrorDiagnostic {
  if (!raw || typeof raw !== "object") {
    return { message: "发生未知错误", suggestion: "请查看日志获取详情", retryable: false };
  }
  const e = raw as Record<string, unknown>;

  // 按错误码匹配
  const code = typeof e.code === "string" ? e.code : undefined;
  if (code && ALL_ERRORS[code]) return ALL_ERRORS[code];

  // 按 HTTP 状态码匹配（从消息中提取）
  const msg = typeof e.message === "string" ? e.message : String(e);
  const statusMatch = msg.match(/\b(401|403|429|500|502|503)\b/);
  if (statusMatch && ALL_ERRORS[statusMatch[1]]) return ALL_ERRORS[statusMatch[1]];

  // 降级通用消息
  return {
    message: "未知错误，请查看日志获取详情",
    suggestion: "如持续出现请联系技术支持",
    retryable: false,
  };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run electron/agent/errorDiagnostics.test.ts
```
预期：4 PASS

- [ ] **Step 5: Commit**

```bash
git add electron/agent/errorDiagnostics.ts electron/agent/errorDiagnostics.test.ts
git commit -m "feat: 新建 errorDiagnostics 模块，覆盖网络/HTTP/第三方错误中文化映射"
```

---

### Task B3: sdkEventStore 消费连接状态 + sdk:error 扩展 suggestion 字段

**Files:**
- Modify: `src/app/sdkUiTypes.ts`
- Modify: `src/app/sdkEventStore.ts`
- Modify: `src/app/sdkEventStore.test.ts`
- Modify: `src/ipc/payloadSchemas.ts`

- [ ] **Step 1: 写失败测试 — sdkEventStore.test.ts**

```typescript
// 新增 to sdkEventStore.test.ts
it("stores connection status on sdk:connection-status event", () => {
  const state = createInitialSdkUiState();
  const result = reduceSdkUiEvent(state, {
    channel: "sdk:connection-status",
    payload: { state: "connected", baseUrl: "https://api.example.com", model: "claude-sonnet", probedAt: Date.now() },
  });
  expect(result.connectionStatus).toBeDefined();
  expect(result.connectionStatus!.state).toBe("connected");
});

it("stores failed connection status with error", () => {
  const state = createInitialSdkUiState();
  const result = reduceSdkUiEvent(state, {
    channel: "sdk:connection-status",
    payload: { state: "failed", baseUrl: "https://bad.example.com", model: "claude-sonnet", probedAt: Date.now(), error: { code: "ENOTFOUND", message: "无法解析", suggestion: "检查 URL" } },
  });
  expect(result.connectionStatus!.state).toBe("failed");
  expect(result.connectionStatus!.error).toBeDefined();
});
```

- [ ] **Step 2: 修改 sdkUiTypes.ts**

```typescript
// 在 SdkUiState 接口中新增
connectionStatus?: {
  state: "connected" | "unverified" | "connecting" | "failed";
  baseUrl: string;
  model: string;
  error?: { code: string; message: string; suggestion: string };
  probedAt: number;
};
```

- [ ] **Step 3: 修改 sdkEventStore.ts**

```typescript
// 在 reduceSdkUiEvent 函数中新增 case
if (event.channel === "sdk:connection-status") {
  return {
    ...state,
    connectionStatus: payload as SdkUiState["connectionStatus"],
  };
}
```

- [ ] **Step 4: 扩展 sdk:error payload schema**

```typescript
// 在 src/ipc/payloadSchemas.ts 的 sdk:error schema 中新增
suggestion: z.string().optional(),
```

- [ ] **Step 5: 运行测试验证**

```bash
npx vitest run src/app/sdkEventStore.test.ts src/ipc/payloadSchemas.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/sdkUiTypes.ts src/app/sdkEventStore.ts src/app/sdkEventStore.test.ts src/ipc/payloadSchemas.ts
git commit -m "feat: sdkEventStore 消费连接状态 + sdk:error 扩展 suggestion 字段"
```

---

### Task B4: 设置面板连接状态指示器

**Files:**
- Modify: `src/app/components/SettingsPanel.tsx`
- Modify: `src/app/components/SettingsPanel.test.tsx`

- [ ] **Step 1: 写失败测试 — SettingsPanel.test.tsx**

```typescript
it("shows connection status indicator when status is connected", () => {
  render(<SettingsPanel bridge={mockBridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" connectionStatus={{ state: "connected", baseUrl: "https://api.example.com", model: "test", probedAt: Date.now() }} />);
  expect(screen.getByText("已连接")).toBeInTheDocument();
});

it("shows error detail when connection fails and user clicks", async () => {
  render(<SettingsPanel bridge={mockBridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" connectionStatus={{ state: "failed", baseUrl: "https://bad.example.com", model: "test", probedAt: Date.now(), error: { code: "ENOTFOUND", message: "无法解析 API 地址", suggestion: "请检查 Base URL" } }} />);
  await userEvent.click(screen.getByText("连接失败"));
  expect(screen.getByText("无法解析 API 地址")).toBeInTheDocument();
  expect(screen.getByText("请检查 Base URL")).toBeInTheDocument();
});
```

- [ ] **Step 2: 修改 SettingsPanel.tsx — Props 扩展**

```typescript
type Props = {
  bridge: SettingsBridge;
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
  activeRunId?: string;
  onApplySettings?: (runId: string, settings: Record<string, unknown>) => void;
  connectionStatus?: {  // ← 新增
    state: string;
    baseUrl: string;
    model: string;
    error?: { code: string; message: string; suggestion: string };
    probedAt: number;
  };
};
```

- [ ] **Step 3: 修改 SettingsPanel.tsx — UI 实现**

在 JSX 的 Base URL 输入框上方新增：

```tsx
{connectionStatus && (
  <div className="connection-status-row">
    <div className={`connection-indicator ${connectionStatus.state}`}
         onClick={() => connectionStatus.state === "failed" && setShowConnectionError(!showConnectionError)}>
      <span className={`activity-indicator ${connectionStatus.state === "connected" ? "done" : connectionStatus.state === "failed" ? "error" : connectionStatus.state === "connecting" ? "active" : "idle"}`} />
      <span className="connection-label">
        {connectionStatus.state === "connected" ? "已连接" :
         connectionStatus.state === "connecting" ? "验证中..." :
         connectionStatus.state === "failed" ? "连接失败" : "未验证"}
      </span>
    </div>
    {showConnectionError && connectionStatus.error && (
      <div className="connection-error-detail">
        <p>{connectionStatus.error.message}</p>
        <p className="connection-error-suggestion">{connectionStatus.error.suggestion}</p>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: 运行测试验证**

```bash
npx vitest run src/app/components/SettingsPanel.test.tsx
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/SettingsPanel.tsx src/app/components/SettingsPanel.test.tsx
git commit -m "feat: 设置面板新增连接状态指示器，支持展开错误详情"
```

---

### Task C1: 新建 modelCapabilities 模块

**Files:**
- Create: `electron/agent/modelCapabilities.ts`
- Create: `electron/agent/modelCapabilities.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// electron/agent/modelCapabilities.test.ts
import { describe, expect, it, vi } from "vitest";
import { detectModelCapabilities, type ModelCapabilities } from "./modelCapabilities.js";

describe("detectModelCapabilities", () => {
  it("returns full capabilities for a model that supports everything", async () => {
    const mockSdk = { query: vi.fn().mockReturnValue({ [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }), close: vi.fn() }) };
    const caps = await detectModelCapabilities(mockSdk as any, "claude-sonnet-4-6");
    expect(caps.model).toBe("claude-sonnet-4-6");
    expect(typeof caps.supportsThinking).toBe("boolean");
    expect(typeof caps.supportsJsonSchema).toBe("boolean");
    expect(typeof caps.supportsPromptCaching).toBe("boolean");
    expect(typeof caps.supportsToolUse).toBe("boolean");
    expect(caps.maxContextWindow).toBeGreaterThan(0);
  });

  it("caches results and returns cached value on second call", async () => {
    const callCount = vi.fn();
    const mockSdk = {
      query: vi.fn().mockImplementation(() => {
        callCount();
        return { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }), close: vi.fn() };
      }),
    };
    await detectModelCapabilities(mockSdk as any, "test-model");
    await detectModelCapabilities(mockSdk as any, "test-model");
    expect(callCount).toHaveBeenCalledTimes(1); // 第二次使用缓存
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run electron/agent/modelCapabilities.test.ts
```

- [ ] **Step 3: 实现 modelCapabilities**

```typescript
// electron/agent/modelCapabilities.ts

export type ModelCapabilities = {
  model: string;
  supportsThinking: boolean;
  supportsJsonSchema: boolean;
  supportsPromptCaching: boolean;
  maxContextWindow: number;
  supportsToolUse: boolean;
  detectedAt: number;
  detectionMethod: "probe" | "heuristic" | "manual";
};

const cache = new Map<string, ModelCapabilities>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

function isCacheValid(entry: ModelCapabilities): boolean {
  return Date.now() - entry.detectedAt < CACHE_TTL_MS;
}

export async function detectModelCapabilities(
  sdk: { query: (...args: any[]) => any },
  model: string,
): Promise<ModelCapabilities> {
  // 检查缓存
  const cached = cache.get(model);
  if (cached && isCacheValid(cached)) return cached;

  try {
    // 并行探测各维度
    const [thinking, toolUse] = await Promise.all([
      probeThinking(sdk, model),
      probeToolUse(sdk, model),
    ]);

    const caps: ModelCapabilities = {
      model,
      supportsThinking: thinking,
      supportsJsonSchema: false, // 单独探测较慢，先用 heuristic
      supportsPromptCaching: false, // 需要从实际响应 usage 判断
      maxContextWindow: 128000, // 保守默认
      supportsToolUse: toolUse,
      detectedAt: Date.now(),
      detectionMethod: thinking || toolUse ? "probe" : "heuristic",
    };

    cache.set(model, caps);
    return caps;
  } catch {
    // 探测失败，使用保守默认值
    const fallback: ModelCapabilities = {
      model,
      supportsThinking: false,
      supportsJsonSchema: false,
      supportsPromptCaching: false,
      maxContextWindow: 128000,
      supportsToolUse: true,
      detectedAt: Date.now(),
      detectionMethod: "heuristic",
    };
    cache.set(model, fallback);
    return fallback;
  }
}

async function probeThinking(sdk: { query: (...args: any[]) => any }, _model: string): Promise<boolean> {
  try {
    const q = sdk.query({
      prompt: [{ type: "user", message: { role: "user", content: "say ok" } }] as any,
      options: { max_turns: 1, thinking: { type: "enabled" as any, budgetTokens: 1024 }, includePartialMessages: false } as any,
    });
    for await (const _msg of q) { /* 消费 */ }
    return true;
  } catch {
    return false;
  }
}

async function probeToolUse(sdk: { query: (...args: any[]) => any }, _model: string): Promise<boolean> {
  try {
    const q = sdk.query({
      prompt: [{ type: "user", message: { role: "user", content: "say ok" } }] as any,
      options: { max_turns: 1, includePartialMessages: false } as any,
    });
    for await (const _msg of q) { /* 消费 */ }
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run electron/agent/modelCapabilities.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add electron/agent/modelCapabilities.ts electron/agent/modelCapabilities.test.ts
git commit -m "feat: 新建 modelCapabilities 模块，支持探测模型能力并缓存结果"
```

---

### Task C2: 模型能力缓存持久化 + 设置面板集成

**Files:**
- Modify: `electron/agent/modelCapabilities.ts` — 缓存读写文件
- Modify: `src/app/sdkUiTypes.ts` — 新增 modelCapabilities state
- Modify: `src/app/sdkEventStore.ts` — 消费能力检测结果
- Modify: `src/app/components/SettingsPanel.tsx` — 灰显逻辑

- [ ] **Step 1: modelCapabilities 缓存持久化**

```typescript
// 在 electron/agent/modelCapabilities.ts 中新增
import fs from "node:fs";
import path from "node:path";

function cacheFilePath(cwd: string) {
  return path.join(cwd, ".claude", "model-capabilities.json");
}

export function loadCapabilitiesCache(cwd: string): void {
  try {
    const raw = fs.readFileSync(cacheFilePath(cwd), "utf8");
    const data = JSON.parse(raw);
    if (data?.entries) {
      for (const [model, caps] of Object.entries(data.entries)) {
        cache.set(model, caps as ModelCapabilities);
      }
    }
  } catch {
    // 文件不存在或损坏，忽略
  }
}

export function saveCapabilitiesCache(cwd: string): void {
  const entries: Record<string, ModelCapabilities> = {};
  for (const [model, caps] of cache) {
    entries[model] = caps;
  }
  const dir = path.dirname(cacheFilePath(cwd));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cacheFilePath(cwd), JSON.stringify({ version: 1, entries }, null, 2), "utf8");
}
```

- [ ] **Step 2: sdkEventStore 消费能力检测结果**

```typescript
// 在 sdkEventStore.ts 中新增 case
// 当 sdk:system-event subtype 为 "capability_degraded" 时
// 在 SdkUiState 中新增 modelCapabilities 字段
```

- [ ] **Step 3: SettingsPanel 灰显逻辑**

```tsx
// 在 SettingsPanel.tsx 中
// thinking 相关选项：
disabled={modelCapabilities && !modelCapabilities.supportsThinking}
title={modelCapabilities && !modelCapabilities.supportsThinking ? "当前模型不支持扩展思考" : undefined}

// outputFormat 开关：
disabled={modelCapabilities && !modelCapabilities.supportsJsonSchema}
title={modelCapabilities && !modelCapabilities.supportsJsonSchema ? "当前模型不支持 JSON Schema 输出" : undefined}

// promptCaching 开关：
disabled={modelCapabilities && !modelCapabilities.supportsPromptCaching}
title={modelCapabilities && !modelCapabilities.supportsPromptCaching ? "当前模型不支持 Prompt Caching" : undefined}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run electron/agent/modelCapabilities.test.ts src/app/components/SettingsPanel.test.tsx
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add electron/agent/modelCapabilities.ts src/app/sdkUiTypes.ts src/app/sdkEventStore.ts src/app/components/SettingsPanel.tsx
git commit -m "feat: 模型能力缓存持久化 + 设置面板能力感知灰显"
```

---

### Task C3: loadAgentRuntimeConfig 自动降级

**Files:**
- Modify: `electron/agent/agentConfig.ts`
- Modify: `electron/agent/agentConfig.test.ts`

- [ ] **Step 1: 写失败测试 — agentConfig.test.ts**

```typescript
it("removes thinking option when model does not support it", async () => {
  // Mock detectModelCapabilities 返回 supportsThinking: false
  const config = await loadAgentRuntimeConfig({ cwd: "/test", userSdkOptions: { thinking: { effort: "high", display: "summarized" } } });
  expect(config.sdkOptions.thinking).toBeUndefined();
});

it("removes outputFormat and injects format instructions to systemPrompt when model does not support jsonSchema", async () => {
  const config = await loadAgentRuntimeConfig({
    cwd: "/test",
    userSdkOptions: {
      outputFormat: { type: "json_schema", json_schema: { name: "test", strict: true, schema: { type: "object", properties: {} } } },
    },
  });
  // 模型不支持 → outputFormat 被移除
  expect(config.sdkOptions.outputFormat).toBeUndefined();
  // 降级指令注入 systemPrompt
  expect(config.sdkOptions.systemPrompt).toContain("JSON 格式输出");
});
```

- [ ] **Step 2: 实现降级逻辑**

在 `loadAgentRuntimeConfig` 中，合并 SDK options 之后：

```typescript
// 在 agentConfig.ts 中新增
import { detectModelCapabilities } from "./modelCapabilities.js";

// ... 在 loadAgentRuntimeConfig 函数体中
const model = (mergedOptions.model as string) ?? settings.model;
if (model) {
  const caps = await detectModelCapabilities(
    { query: /* 无法在此获取，在 AgentSessionManager 层调用 */ },
    model,
  );

  if (!caps.supportsThinking) {
    delete mergedOptions.thinking;
    delete mergedOptions.effort;
    degradations.push({ feature: "thinking", reason: "模型不支持" });
  }
  if (!caps.supportsJsonSchema && mergedOptions.outputFormat) {
    const promptInjection = degradeOutputFormatToPrompt(mergedOptions.outputFormat as any);
    mergedOptions.systemPrompt = (mergedOptions.systemPrompt ?? "") + "\n\n" + promptInjection;
    delete mergedOptions.outputFormat;
    degradations.push({ feature: "jsonSchema", reason: "模型不支持，已降级为自然语言格式要求" });
  }
  if (!caps.supportsPromptCaching) {
    delete mergedOptions.promptCaching;
    degradations.push({ feature: "promptCaching", reason: "模型不支持" });
  }
}
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest run electron/agent/agentConfig.test.ts
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: loadAgentRuntimeConfig 实现模型能力检测驱动的自动降级"
```

---

### Task C4: 降级通知到前端

**Files:**
- Modify: `src/ipc/payloadSchemas.ts` — `sdk:system-event` subtype 扩展
- Modify: `electron/agent/agentSessionManager.ts` — 发出降级通知
- Modify: `src/app/sdkEventStore.ts` — 消费降级通知

- [ ] **Step 1: 扩展 payload schema**

```typescript
// sdk:system-event schema 的 subtype enum 扩展
subtype: z.enum([
  // ... existing subtypes,
  "capability_degraded",  // ← 新增
  "process_health",       // ← 预留（阶段三）
  "retry_attempt",        // ← 预留（阶段三）
])
```

- [ ] **Step 2: AgentSessionManager 发出降级通知**

```typescript
// 在 startRun 中，loadAgentRuntimeConfig 返回 degradations 后
if (degradations.length > 0) {
  this.deps.emit("sdk:system-event", {
    runId,
    subtype: "capability_degraded",
    raw: { model, degradations },
  });
}
```

- [ ] **Step 3: sdkEventStore 消费**

```typescript
// 在 reduceSdkUiEvent 中 sdk:system-event 处理块
if (payload.subtype === "capability_degraded") {
  return {
    ...state,
    activeRunId,
    capabilityDegradations: (payload.raw as any).degradations ?? [],
  };
}
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- electron/agent/agentSessionManager.test.ts src/app/sdkEventStore.test.ts src/ipc/payloadSchemas.test.ts
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/ipc/payloadSchemas.ts electron/agent/agentSessionManager.ts src/app/sdkEventStore.ts
git commit -m "feat: 降级行为通过 sdk:system-event 通知前端展示"
```

---

### Task J1: 第三方 API usage 格式兼容

**Files:**
- Modify: `src/app/sdkEventStore.ts` — `normalizeUsage()` 扩展
- Modify: `src/app/sdkEventStore.test.ts`

- [ ] **Step 1: 写失败测试 — 新增兼容格式**

```typescript
it("normalizes total_tokens into input/output 3:1 split", () => {
  const raw = { total_tokens: 4000 };
  const result = normalizeUsage(raw);
  expect(result.inputTokens).toBe(3000);
  expect(result.outputTokens).toBe(1000);
});

it("normalizes prompt_tokens/completion_tokens to input/output", () => {
  const raw = { prompt_tokens: 500, completion_tokens: 200 };
  const result = normalizeUsage(raw);
  expect(result.inputTokens).toBe(500);
  expect(result.outputTokens).toBe(200);
});

it("handles nested response.usage", () => {
  const raw = { response: { usage: { input_tokens: 100, output_tokens: 50 } } };
  const result = normalizeUsage(raw);
  expect(result.inputTokens).toBe(100);
  expect(result.outputTokens).toBe(50);
});
```

- [ ] **Step 2: 实现兼容逻辑（见 spec 第 600-626 行）**

- [ ] **Step 3: 运行测试**

```bash
npx vitest run src/app/sdkEventStore.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/sdkEventStore.ts src/app/sdkEventStore.test.ts
git commit -m "fix: normalizeUsage 兼容第三方 API 的 total_tokens/prompt_tokens/嵌套 usage 格式"
```

---

### Task J2: accountInfo() 替换

**Files:**
- Modify: `electron/agent/agentSessionManager.ts`

- [ ] **Step 1: 修改 accountInfo 方法**

```typescript
async accountInfo(runId: string) {
  const raw = await this.session(runId).accountInfo();
  const config = await this.loadConfig({ cwd: this.deps.cwd ?? process.cwd(), claudeConfigDir: this.deps.configDir });
  const env = (config.sdkOptions.env ?? {}) as Record<string, string>;
  return {
    endpoint: env.ANTHROPIC_BASE_URL ?? "",
    model: env.ANTHROPIC_MODEL ?? "",
    provider: "third_party",
    sdkApiProvider: (raw as any)?.apiProvider,
  };
}
```

- [ ] **Step 2: 运行测试**

```bash
npm test -- electron/agent/agentSessionManager.test.ts
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add electron/agent/agentSessionManager.ts
git commit -m "feat: accountInfo 替换为第三方 API 端点信息"
```

---

### Task J3: initializationResult() 替换

**Files:**
- Modify: `electron/agent/agentSessionManager.ts`

- [ ] **Step 1: 修改 initializationResult 方法**

```typescript
async initializationResult(runId: string) {
  // 获取连接状态作为初始化结果
  const settings = loadClaudeCodeSettings({ cwd: this.deps.cwd ?? process.cwd() });
  return {
    endpoint: settings.baseUrl,
    authenticated: !!settings.apiKey,
    model: settings.model,
    provider: "third_party",
  };
}
```

需要 import `loadClaudeCodeSettings`：
```typescript
import { loadClaudeCodeSettings } from "./sdkSettings.js";
```

- [ ] **Step 2: 运行测试 + 构建**

```bash
npm test -- electron/agent/agentSessionManager.test.ts
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add electron/agent/agentSessionManager.ts
git commit -m "feat: initializationResult 替换为第三方 API 连接验证结果"
```

---

### 阶段一验证检查点

```bash
npm test -- electron/agent/connectionProbe.test.ts electron/agent/errorDiagnostics.test.ts electron/agent/modelCapabilities.test.ts electron/agent/agentConfig.test.ts electron/agent/agentSessionManager.test.ts
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts
npm test -- src/app/sdkEventStore.test.ts src/app/components/SettingsPanel.test.tsx
npm run build
```

---

## 阶段二：功能适配层

---

### Task D1: outputFormat 配置暴露

**Files:**
- Modify: `electron/agent/agentConfig.ts` — `UserSdkOptions` 新增 `outputFormat`
- Modify: `src/ipc/payloadSchemas.ts` — `run:apply-settings` schema 扩展
- Modify: `src/app/backendBridge.ts` — 类型扩展

- [ ] **Step 1: 写失败测试 — agentConfig.test.ts**

```typescript
it("accepts valid outputFormat in userSdkOptions", () => {
  const opts = sanitizeUserSdkOptions({
    outputFormat: {
      type: "json_schema",
      json_schema: { name: "test_plan", strict: true, schema: { type: "object", properties: {} } },
    },
  });
  expect(opts.outputFormat).toBeDefined();
  expect(opts.outputFormat!.json_schema.name).toBe("test_plan");
});

it("rejects invalid outputFormat (missing name)", () => {
  const opts = sanitizeUserSdkOptions({
    outputFormat: { type: "json_schema", json_schema: { strict: true, schema: {} } },
  });
  expect(opts.outputFormat).toBeUndefined(); // 校验失败丢弃
});
```

- [ ] **Step 2: 实现 — agentConfig.ts**

在 `UserSdkOptions` 中：
```typescript
outputFormat?: {
  type: "json_schema";
  json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
};
```

在 `sanitizeUserSdkOptions` 中：
```typescript
if (source.outputFormat && typeof source.outputFormat === "object" && !Array.isArray(source.outputFormat)) {
  const fmt = source.outputFormat as Record<string, unknown>;
  if (fmt.type === "json_schema" && fmt.json_schema && typeof fmt.json_schema === "object") {
    const js = fmt.json_schema as Record<string, unknown>;
    if (typeof js.name === "string" && js.name.length > 0 && js.schema && typeof js.schema === "object") {
      options.outputFormat = fmt as UserSdkOptions["outputFormat"];
    }
  }
}
```

- [ ] **Step 3: 扩展 payload schema**

```typescript
// run:apply-settings schema 中新增
outputFormat: z.object({
  type: z.literal("json_schema"),
  json_schema: z.object({
    name: z.string().min(1),
    strict: z.boolean(),
    schema: z.record(z.unknown()),
  }),
}).optional(),
```

- [ ] **Step 4: 扩展 backendBridge.ts**

```typescript
// applySettings 参数类型新增
outputFormat?: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
```

- [ ] **Step 5: 运行测试**

```bash
npm test -- electron/agent/agentConfig.test.ts src/ipc/payloadSchemas.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add electron/agent/agentConfig.ts src/ipc/payloadSchemas.ts src/app/backendBridge.ts
git commit -m "feat: UserSdkOptions + IPC schema 暴露 outputFormat 配置"
```

---

### Task D2: 新建 outputSchemas 预设模板

**Files:**
- Create: `src/domain/outputSchemas.ts`
- Create: `src/domain/outputSchemas.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// src/domain/outputSchemas.test.ts
import { describe, expect, it } from "vitest";
import { OUTPUT_SCHEMA_TEMPLATES } from "./outputSchemas.js";
import { z } from "zod/v4";

describe("OUTPUT_SCHEMA_TEMPLATES", () => {
  it("has test_plan template with required fields", () => {
    const tpl = OUTPUT_SCHEMA_TEMPLATES.find(t => t.id === "test_plan");
    expect(tpl).toBeDefined();
    expect(tpl!.outputFormat).not.toBeNull();
  });

  it("has bug_report template with required fields", () => {
    const tpl = OUTPUT_SCHEMA_TEMPLATES.find(t => t.id === "bug_report");
    expect(tpl).toBeDefined();
    expect(tpl!.outputFormat).not.toBeNull();
  });

  it("has custom template with null outputFormat", () => {
    const tpl = OUTPUT_SCHEMA_TEMPLATES.find(t => t.id === "custom");
    expect(tpl).toBeDefined();
    expect(tpl!.outputFormat).toBeNull();
  });
});
```

- [ ] **Step 2: 实现 — 见 spec 第 798-874 行**

- [ ] **Step 3: 运行测试**

```bash
npx vitest run src/domain/outputSchemas.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/outputSchemas.ts src/domain/outputSchemas.test.ts
git commit -m "feat: 新增 outputSchemas 预设模板（测试计划/缺陷报告/证据摘要/自定义）"
```

---

### Task D3: 设置面板 outputFormat 配置

**Files:**
- Modify: `src/app/components/SettingsPanel.tsx`

实现在"高级设置"折叠区新增结构化输出开关、模板下拉、自定义 Schema 文本区域。见 spec 第 891-902 行 UI 规格。

- [ ] **Step 1: 修改 SettingsPanel.tsx — 新增 state**

```typescript
const [outputFormatEnabled, setOutputFormatEnabled] = useState(false);
const [outputFormatTemplate, setOutputFormatTemplate] = useState("test_plan");
const [customSchema, setCustomSchema] = useState("");
```

- [ ] **Step 2: 修改 SettingsPanel.tsx — 新增 UI**

```tsx
{/* 在高级设置区域 */}
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

{outputFormatEnabled && (
  <>
    <div className="setting-row">
      <label className="setting-label" htmlFor="output-template">输出模板</label>
      <select id="output-template" value={outputFormatTemplate} onChange={(e) => setOutputFormatTemplate(e.target.value)}>
        {OUTPUT_SCHEMA_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
    </div>
    {outputFormatTemplate === "custom" && (
      <div className="setting-row">
        <label className="setting-label" htmlFor="custom-schema">自定义 Schema</label>
        <textarea id="custom-schema" value={customSchema} onChange={(e) => setCustomSchema(e.target.value)} placeholder='{ "type": "object", "properties": {...} }' style={{ fontFamily: "var(--font-mono)", minHeight: 120 }} />
      </div>
    )}
  </>
)}
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest run src/app/components/SettingsPanel.test.tsx
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/SettingsPanel.tsx src/app/components/SettingsPanel.test.tsx
git commit -m "feat: 设置面板新增结构化输出配置（开关+模板+自定义Schema）"
```

---

### Task D4: 结构化输出降级 — system prompt 注入

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 实现降级函数**

```typescript
// 在 agentConfig.ts 中新增
function degradeOutputFormatToPrompt(of: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } }): string {
  const schema = of.json_schema.schema;
  const fields = extractFieldNames(schema);
  const lines = ["请以 JSON 格式输出，必须包含以下字段："];
  for (const f of fields) {
    lines.push(`- ${f}`);
  }
  lines.push("");
  lines.push("以 ```json ... ``` 代码块包裹 JSON 输出。");
  return lines.join("\n");
}

function extractFieldNames(schema: Record<string, unknown>, prefix = ""): string[] {
  const result: string[] = [];
  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    for (const [key, prop] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const desc = prop.description ? ` (${prop.description})` : "";
      const type = typeof prop.type === "string" ? prop.type : "string";
      if (prop.type === "object" && prop.properties) {
        result.push(...extractFieldNames(prop as any, fullPath));
      } else if (prop.type === "array" && prop.items && typeof prop.items === "object") {
        result.push(`${fullPath}: ${type}[]${desc}`);
        if ((prop.items as any).type === "object") {
          result.push(...extractFieldNames(prop.items as any, `${fullPath}[*]`));
        }
      } else {
        result.push(`${fullPath}: ${type}${desc}`);
      }
    }
  }
  return result;
}
```

- [ ] **Step 2: 集成到 loadAgentRuntimeConfig 降级逻辑（见 Task C3）**

- [ ] **Step 3: 运行测试**

```bash
npm test -- electron/agent/agentConfig.test.ts
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: outputFormat 降级方案——从 schema 提取字段注入 system prompt"
```

---

### Task F1: promptCaching 配置链路补全

**Files:**
- Modify: `electron/agent/agentConfig.ts` — `sanitizeUserSdkOptions` 赋值
- Modify: `electron/agent/sdkSettings.ts` — `SettingsFormValues` 扩展 + 持久化
- Modify: `src/ipc/payloadSchemas.ts` — `settings:save` schema 扩展
- Modify: `src/app/backendBridge.ts` — 类型扩展

- [ ] **Step 1: agentConfig.ts — 补全 sanitizeUserSdkOptions 中 promptCaching 赋值**

```typescript
// 在 sanitizeUserSdkOptions 函数中，B 组类型守卫区域新增：
if (typeof source.promptCaching === "boolean") options.promptCaching = source.promptCaching;
```

- [ ] **Step 2: agentConfig.ts — loadAgentRuntimeConfig 传递**

```typescript
// sdkOptions 中新增
...(userSdkOptions.promptCaching !== undefined ? { promptCaching: userSdkOptions.promptCaching } : {}),
```

- [ ] **Step 3: sdkSettings.ts — SettingsFormValues 扩展**

```typescript
export type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
  effort?: string;
  sandboxEnabled?: boolean;
  promptCaching?: boolean;  // ← 新增
};
```

持久化：
```typescript
// saveClaudeCodeSettings 中：
...(input.promptCaching !== undefined ? { CLAUDE_CODE_PROMPT_CACHING: String(input.promptCaching) } : {}),
```

- [ ] **Step 4: payloadSchemas.ts + backendBridge.ts 扩展**

```typescript
// settings:save schema:
promptCaching: z.boolean().optional(),
```

- [ ] **Step 5: 运行测试**

```bash
npm test -- electron/agent/agentConfig.test.ts electron/agent/sdkSettings.test.ts src/ipc/payloadSchemas.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add electron/agent/agentConfig.ts electron/agent/sdkSettings.ts src/ipc/payloadSchemas.ts src/app/backendBridge.ts
git commit -m "feat: 补全 promptCaching 从设置到 SDK options 的完整链路"
```

---

### Task F2: 缓存命中率监控

**Files:**
- Modify: `src/app/sdkUiTypes.ts` — `TokenUsage` 新增 `cacheHitRate`
- Modify: `src/app/sdkEventStore.ts` — `sdk:usage` 计算命中率
- Modify: `src/app/components/MessageStream.tsx` — 状态栏展示

- [ ] **Step 1: sdkUiTypes.ts — TokenUsage 扩展**

```typescript
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  contextTokens?: number;
  maxContextTokens?: number;
  cacheHitRate?: number;  // ← 新增
};
```

- [ ] **Step 2: sdkEventStore.ts — 计算命中率**

```typescript
// 在 sdk:usage case 中，normalizeUsage 之后：
const usage = normalizeUsage(payload.raw);
if (usage.cacheReadInputTokens !== undefined && usage.inputTokens > 0) {
  usage.cacheHitRate = Math.round((usage.cacheReadInputTokens / usage.inputTokens) * 100);
}
```

- [ ] **Step 3: MessageStream.tsx — 展示命中率**

```tsx
{state.usage?.cacheHitRate !== undefined && state.promptCachingEnabled && (
  <span className={`cache-hit-rate ${(state.usage.cacheHitRate ?? 0) < 20 ? "low" : (state.usage.cacheHitRate ?? 0) >= 80 ? "high" : ""}`}
        title={(state.usage.cacheHitRate ?? 0) < 20 ? "命中率偏低，检查系统提示是否频繁变动" : undefined}>
    缓存命中率：{state.usage.cacheHitRate}%
  </span>
)}
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- src/app/sdkEventStore.test.ts
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/sdkUiTypes.ts src/app/sdkEventStore.ts src/app/components/MessageStream.tsx
git commit -m "feat: UI 展示 Prompt 缓存命中率，低命中率时给出优化建议"
```

---

### Task G1: 新建 systemPromptBuilder 模块

**Files:**
- Create: `electron/agent/systemPromptBuilder.ts`
- Create: `electron/agent/systemPromptBuilder.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// electron/agent/systemPromptBuilder.test.ts
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./systemPromptBuilder.js";
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from "./claudeAgentSdkFacade.js";

describe("buildSystemPrompt", () => {
  it("includes SYSTEM_PROMPT_DYNAMIC_BOUNDARY between static and dynamic parts", () => {
    const ctx = {
      staticParts: ["你是 AI 测试助手。", "遵循 TDD 原则。"],
      dynamicContext: {
        currentTime: "2026-05-31 12:00",
        userName: "测试员",
        projectName: "订单系统",
        environmentName: "UAT",
        sessionId: "session-123",
      },
    };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain(SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
    const boundaryIndex = prompt.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
    const before = prompt.slice(0, boundaryIndex);
    const after = prompt.slice(boundaryIndex + SYSTEM_PROMPT_DYNAMIC_BOUNDARY.length);
    expect(before).toContain("AI 测试助手");
    expect(before).toContain("TDD 原则");
    expect(after).toContain("当前时间");
    expect(after).toContain("session-123");
  });
});
```

- [ ] **Step 2: 实现 — 见 spec 第 1061-1072 行**

- [ ] **Step 3: 运行测试**

```bash
npx vitest run electron/agent/systemPromptBuilder.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add electron/agent/systemPromptBuilder.ts electron/agent/systemPromptBuilder.test.ts
git commit -m "feat: 新建 systemPromptBuilder，使用 SYSTEM_PROMPT_DYNAMIC_BOUNDARY 划分静态/动态段"
```

---

### Task G2: AgentSessionManager + agentConfig 集成

**Files:**
- Modify: `electron/agent/agentSessionManager.ts` — `startRun()` 调用 builder
- Modify: `electron/agent/agentConfig.ts` — `loadAgentRuntimeConfig` 合并 systemPrompt

- [ ] **Step 1: 修改 AgentSessionManager.startRun()**

```typescript
import { buildSystemPrompt } from "./systemPromptBuilder.js";

// 在 startRun 中 config 加载后：
const systemPrompt = buildSystemPrompt({
  staticParts: [
    "你是 AI 测试助手，帮助测试人员生成测试计划、执行测试、收集证据、生成缺陷草稿。",
    "请始终使用中文回复。",
  ],
  dynamicContext: {
    currentTime: new Date().toISOString(),
    userName: "测试员",
    projectName: "待定",
    environmentName: "待定",
    sessionId: runId,
  },
});

const mergedOptions = {
  ...config.sdkOptions,
  systemPrompt: systemPrompt + (config.sdkOptions.systemPrompt ? "\n\n" + config.sdkOptions.systemPrompt : ""),
};
```

- [ ] **Step 2: 运行测试 + 构建**

```bash
npm test -- electron/agent/agentSessionManager.test.ts
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add electron/agent/agentSessionManager.ts electron/agent/agentConfig.ts
git commit -m "feat: AgentSessionManager 集成 systemPromptBuilder，每次请求注入动态上下文"
```

---

### Task H1: 新建 customTools 模块

**Files:**
- Create: `electron/agent/customTools.ts`
- Create: `electron/agent/customTools.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// electron/agent/customTools.test.ts
import { describe, expect, it } from "vitest";
import { customTools } from "./customTools.js";

describe("customTools", () => {
  it("defines 3 tools with valid names and descriptions", () => {
    expect(customTools).toHaveLength(3);
    for (const tool of customTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.description).toMatch(/[一-鿿]/); // 含中文描述
    }
  });

  it("includes generate_test_report tool", () => {
    const tool = customTools.find(t => t.name === "generate_test_report");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("测试报告");
  });

  it("includes create_bug_draft tool", () => {
    const tool = customTools.find(t => t.name === "create_bug_draft");
    expect(tool).toBeDefined();
  });

  it("includes capture_evidence tool", () => {
    const tool = customTools.find(t => t.name === "capture_evidence");
    expect(tool).toBeDefined();
  });
});
```

- [ ] **Step 2: 实现 — 见 spec 第 1136-1194 行**

- [ ] **Step 3: 运行测试**

```bash
npx vitest run electron/agent/customTools.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add electron/agent/customTools.ts electron/agent/customTools.test.ts
git commit -m "feat: 新建 customTools，定义 generate_test_report/create_bug_draft/capture_evidence"
```

---

### Task H2: 自定义工具注册到 SDK

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 在 loadAgentRuntimeConfig 中合并工具**

```typescript
import { customTools } from "./customTools.js";

// sdkOptions 中：
tools: [...(userSdkOptions.tools ?? []), ...customTools],
```

- [ ] **Step 2: 运行测试**

```bash
npm test -- electron/agent/agentConfig.test.ts
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add electron/agent/agentConfig.ts
git commit -m "feat: loadAgentRuntimeConfig 自动注册应用内置自定义工具"
```

---

### Task H3: 新建 appMcpServer 模块

**Files:**
- Create: `electron/agent/appMcpServer.ts`

- [ ] **Step 1: 实现**

```typescript
// electron/agent/appMcpServer.ts
import { createSdkMcpServer } from "./claudeAgentSdkFacade.js";

export const appMcpServer = createSdkMcpServer({
  name: "ai-test-assistant",
  version: "0.1.0",
});
```

- [ ] **Step 2: 在 agentConfig 中注册**

```typescript
import { appMcpServer } from "./appMcpServer.js";

// 在 mcpServers 合并后：
if (appMcpServer) {
  mergedOptions.mcpServers = {
    ...(mergedOptions.mcpServers ?? {}),
    "ai-test-assistant": appMcpServer,
  };
}
```

- [ ] **Step 3: 运行构建**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add electron/agent/appMcpServer.ts electron/agent/agentConfig.ts
git commit -m "feat: 新建 appMcpServer，将应用注册为 MCP Server"
```

---

### 阶段二验证检查点

```bash
npm test -- electron/agent/agentConfig.test.ts electron/agent/systemPromptBuilder.test.ts electron/agent/customTools.test.ts
npm test -- src/domain/outputSchemas.test.ts
npm test -- src/app/sdkEventStore.test.ts src/app/components/SettingsPanel.test.tsx
npm test -- src/ipc/payloadSchemas.test.ts
npm run build
```

---

## 阶段一+二 Playwright E2E 验证

```bash
npx playwright test tests/e2e/connection-status.spec.ts tests/e2e/model-capabilities.spec.ts tests/e2e/third-party-compat.spec.ts tests/e2e/structured-output.spec.ts tests/e2e/prompt-caching.spec.ts tests/e2e/dynamic-system-prompt.spec.ts tests/e2e/custom-tools.spec.ts
```
