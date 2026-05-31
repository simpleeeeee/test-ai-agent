# Claude Agent SDK 第三方 API 场景适配设计

日期：2026-05-31
状态：设计审批中

## 一、背景与目标

### 背景

本项目 AI 测试助手通过 `@anthropic-ai/claude-agent-sdk`（版本 `^0.3.150`）作为 Agent 运行时，运行架构为：

```
Electron 主进程 → ClaudeAgentRuntimeAdapter → SDK query() → Claude Code 原生二进制
                                                                     │
                                                              HTTP 请求
                                                                     │
                                                          第三方 API 端点
                                                              (ANTHROPIC_BASE_URL)
```

**核心约束：本项目不调用 Anthropic 官方 API，仅调用中国大陆境内兼容 Anthropic API 的第三方 LLM API。** 这一约束对 SDK 原生功能的使用产生以下影响：

1. SDK 中依赖 Anthropic 服务端的特性不可用（OAuth、Remote Control、Claude.ai MCP Proxy 等）
2. SDK 中依赖模型能力的特性需要运行时检测 + 自动降级（thinking、JSON Schema、prompt caching）
3. SDK 返回的账户/模型信息需要替换为第三方 API 的实际数据
4. 第三方 API 的错误码/响应格式需要兼容处理
5. 第三方 API 的稳定性通常不如 Anthropic 官方，需要更强的进程管理和错误恢复

经过 `2026-05-31-claude-agent-sdk-adapter-audit-design.md` 对已有链路的修复后，本项目的基础事件流（thinking、tool input delta、usage、permission denial 等）已处于闭合状态。本 spec 聚焦于**尚未适配的 SDK 原生功能**，将它们按依赖关系编排为四个阶段。

### 目标

1. 建立连接验证机制，启动时检测第三方 API 端点可达性，提供中文化错误诊断
2. 建立模型能力检测机制，运行时探测模型是否支持 thinking / JSON Schema / prompt caching，不支持时自动降级
3. 适配结构化输出 (`outputFormat`)、Prompt Caching、`SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 等对测试场景有直接价值的功能
4. 定义测试领域自定义工具 (`tool()`)，将应用自身注册为 MCP Server (`createSdkMcpServer()`)
5. 实现自定义进程管理，支持 Claude Code 子进程崩溃自动恢复和优雅关闭
6. 完善第三方 API 特有的错误处理、日志和重试策略
7. 补齐设置面板，将所有新增配置项暴露给用户
8. 所有变更通过 Playwright E2E 测试验证

### 全局规则：IPC 变更同步

**凡涉及 IPC 通道或 payload 变更，必须同步以下全部文件，并运行测试和构建：**

| 文件 | 变更要求 |
|------|----------|
| `src/ipc/channels.ts` | 新增/修改通道常量定义 |
| `src/ipc/payloadSchemas.ts` | Zod schema 同步扩展 |
| `src/app/backendBridge.ts` | 渲染进程调用接口同步 |
| `electron/main.ts` | 主进程 handler 同步 |
| `electron/preload.ts` | preload 暴露接口同步（如需新增 API） |
| `electron/preloadApi.ts` | preload API 类型同步（如需新增 API） |

验证命令：
```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts
npm test -- src/app/backendBridge.test.ts
npm run build
```

---

## 二、非目标

1. 不替换 `@anthropic-ai/claude-agent-sdk` 为其他 SDK
2. 不绕过 `assertThirdPartyBaseUrl()` 限制，不允许 Anthropic 官方端点进入运行配置
3. 不在此 spec 中实现完整的文件管理 UI、复杂子代理编排器
4. 不实现 `SessionStore`、`BridgeSessionHandle`、`ConnectRemoteControl`、OAuth 相关等依赖 Anthropic 服务端的功能
5. 不改变现有 Electron 主进程作为 SDK 唯一调用方的边界
6. 不修改 Thinking 流、工具参数流、result 元数据映射等已在 `2026-05-31-claude-agent-sdk-adapter-audit-design.md` 中覆盖的内容

---

## 三、总体架构概览

### 四阶段依赖图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         阶段一：基础设施层                            │
│                                                                     │
│  B. 连接验证与错误诊断 ──→ C. 模型能力检测与自动降级                   │
│         │                          │                                │
│         └──────────┬───────────────┘                                │
│                    ▼                                                │
│            J. 第三方 API 特殊处理                                    │
│                                                                     │
│  交付：错误诊断引擎 / 能力检测引擎 / API 响应兼容层                     │
├─────────────────────────────────────────────────────────────────────┤
│                         阶段二：功能适配层                            │
│                                                                     │
│  D. 结构化输出 ──→ F. Prompt Caching ──→ G. 动态提示边界              │
│                                              │                      │
│  H. 自定义工具 (独立，可并行)                   │                      │
│                                              ▼                      │
│  交付：outputFormat 配置+降级 / caching 控制 / system prompt 优化     │
│        / 测试领域 tool 定义 + MCP Server                             │
├─────────────────────────────────────────────────────────────────────┤
│                         阶段三：运维增强层                            │
│                                                                     │
│  I. 进程管理 ──→ L. 错误处理与日志                                    │
│                                                                     │
│  交付：进程崩溃恢复 / 中文化错误 / 调试日志 / 重试策略                  │
├─────────────────────────────────────────────────────────────────────┤
│                         阶段四：用户界面层                            │
│                                                                     │
│  K. 设置面板功能补齐（汇总前三个阶段全部配置项）                        │
│                                                                     │
│  交付：完整的设置面板 UI / 配置持久化 / E2E 验证                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据流全景

```
┌─ 设置面板 (渲染进程) ────────────────────────────────────────────────┐
│                                                                      │
│  SettingsPanel.tsx                                                   │
│    │ 用户配置                                                        │
│    ▼                                                                 │
│  backendBridge.saveSettings()                                        │
│    │ IPC: settings:save                                              │
├────┼─────────────────────────────────────────────────────────────────┤
│    ▼                                                                 │
│  main.ts handler                                                     │
│    │                                                                 │
│    ▼                                                                 │
│  sdkSettings.saveClaudeCodeSettings()  ← 持久化到 .claude/settings.json│
│  sdkSettings.saveAppSettings()         ← 持久化到 .claude/app-settings│
│                                                                      │
│  AgentSessionManager.startRun()                                       │
│    │                                                                 │
│    ├─→ connectionProbe.probeConnection()    ← B: 连接验证            │
│    ├─→ modelCapabilities.detect()           ← C: 能力检测            │
│    ├─→ loadAgentRuntimeConfig() 合并配置     ← D/F/G: 功能配置       │
│    │     ├─ outputFormat / promptCaching                             │
│    │     ├─ systemPrompt (含 DYNAMIC_BOUNDARY)                       │
│    │     ├─ customTools + appMcpServer         ← H: 自定义工具       │
│    │     └─ codeOptions.spawnClaudeCodeProcess  ← I: 进程管理        │
│    │                                                                 │
│    ▼                                                                 │
│  ClaudeAgentRuntimeAdapter.start()                                   │
│    │                                                                 │
│    ▼                                                                 │
│  SDK query() ──→ Claude Code 子进程 ──→ 第三方 API                    │
│    │                                                                 │
│    ▼                                                                 │
│  drainMessages()                                                     │
│    ├─→ runEventMapper.map()     ← J: 第三方响应兼容                  │
│    ├─→ errorDiagnostics         ← B/L: 错误诊断                      │
│    └─→ retry logic              ← L: 重试策略                        │
│    │                                                                 │
│    ▼                                                                 │
│  emit(runEvent) ──→ IPC ──→ sdkEventStore ──→ UI 渲染               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 四、阶段一：基础设施层（11 tasks）

### B. 连接验证与错误诊断

#### B1. 启动时 API 连通性验证

**背景：** 当前 `main.ts` 调用 `startup()` 预热 SDK 后，无显式的连通性验证步骤。用户配置了错误的 baseUrl 或 apiKey 时，只能在第一次对话时看到 Claude Code 子进程的原始英文错误，排查困难。

**目标：** 在 `startup()` 返回后，通过已预热的 `warmQuery` 发送轻量探测，验证第三方 API 端点可达性和鉴权有效性，结果通过 IPC 推送到渲染进程。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/connectionProbe.ts` | **新建** — 连接探测逻辑 |
| `electron/main.ts` | 修改 — 在 `startup().then()` 中调用探测 |
| `src/ipc/channels.ts` | 修改 — 新增 `"sdk:connection-status"` 通道 |
| `src/ipc/payloadSchemas.ts` | 修改 — 新增 `ConnectionStatus` Zod schema |
| `src/app/backendBridge.ts` | 修改 — `subscribe()` 的 `streamChannels` 数组新增通道 |
| `electron/preload.ts` | 无需变更 |
| `electron/preloadApi.ts` | 无需变更 |

**接口类型定义草案：**

```typescript
// electron/agent/connectionProbe.ts

export type ConnectionState = "connected" | "unverified" | "connecting" | "failed";

export type ConnectionStatus = {
  state: ConnectionState;
  baseUrl: string;
  model: string;
  error?: {
    code: string;        // 错误码（ENOTFOUND / 401 / 403 / 429 / 500 / ...）
    message: string;     // 中文化错误消息
    suggestion: string;  // 排查建议
  };
  probedAt: number;      // Unix 时间戳（毫秒）
};

export function probeConnection(
  warmQuery: { query: typeof import("./claudeAgentSdkFacade.js").query }
): Promise<ConnectionStatus>;
```

**时序图：**

```
main.ts                    connectionProbe          warmQuery           第三方API
  │                              │                      │                   │
  │  startup().then(warmQuery)   │                      │                   │
  │─────────────────────────────→│                      │                   │
  │                              │  probeConnection()    │                   │
  │                              │─────────────────────→│                   │
  │                              │                      │  轻量探测请求      │
  │                              │                      │──────────────────→│
  │                              │                      │←──── 200/error ───│
  │                              │←── ConnectionStatus ─│                   │
  │←── IPC: sdk:connection-status                       │                   │
  │                              │                      │                   │
```

**验收标准：**
- 启动后用有效配置探测 → `state: "connected"` → 状态指示器为绿色
- 无效 baseUrl（DNS 失败）→ `state: "failed"` + error.code = "ENOTFOUND"
- 无效 apiKey → `state: "failed"` + error.code = "401"
- 探测超时（10s）→ `state: "failed"` + error.code = "TIMEOUT"

**测试要点：**
- 单元测试：`connectionProbe.test.ts` — 模拟 warmQuery 行为，覆盖 4 种状态
- IPC 测试：`payloadSchemas.test.ts` — `ConnectionStatus` schema 通过/拒绝非法输入

---

#### B2. 连接状态 IPC 通道

**目标：** 在 IPC 合约中新增 `"sdk:connection-status"` 通道，payload 为 `ConnectionStatus`。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `src/ipc/channels.ts` | 修改 — `mainToRendererChannels` 新增 `"sdk:connection-status"` |
| `src/ipc/payloadSchemas.ts` | 修改 — 新增 schema |
| `src/app/backendBridge.ts` | 修改 — `streamChannels` 新增通道 |
| `electron/main.ts` | 修改 — `sendToRenderer` 调用点 |
| `electron/preload.ts` | 无需变更 — `on` 通用接口已覆盖 |
| `electron/preloadApi.ts` | 无需变更 |

**IPC 同步验证：**
```bash
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts
npm run build
```

---

#### B3. 常见错误中文化映射

**背景：** Claude Code 子进程的原始错误信息为英文，第三方 API 的特有错误码也不在 SDK 的标准覆盖范围内。

**目标：** 建立统一的错误诊断映射表，将常见网络错误、HTTP 状态码和第三方 API 特有错误码翻译为中文消息和排查建议。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/errorDiagnostics.ts` | **新建** — 错误映射表和诊断函数 |

**接口类型定义草案：**

```typescript
// electron/agent/errorDiagnostics.ts

export type ErrorDiagnostic = {
  message: string;      // 中文化错误消息
  suggestion: string;   // 排查建议
  retryable: boolean;   // 是否可重试
};

// 基础映射：网络/DNS/HTTP 标准错误
export const NETWORK_ERRORS: Record<string, ErrorDiagnostic> = {
  ENOTFOUND:     { message: "无法解析 API 地址",    suggestion: "请检查 Base URL 是否正确，确保不包含拼写错误", retryable: true },
  ECONNREFUSED:  { message: "API 服务拒绝连接",     suggestion: "请确认 Base URL 的端口和协议 (http/https) 是否正确", retryable: true },
  ETIMEDOUT:     { message: "API 请求超时",         suggestion: "请检查网络连接或 API 服务是否响应正常", retryable: true },
  ECONNRESET:    { message: "连接被重置",           suggestion: "网络波动导致，可重试。如持续出现请联系 API 提供商", retryable: true },
  "401":         { message: "API Key 无效或已过期",  suggestion: "请在设置中更新 API Key", retryable: false },
  "403":         { message: "无访问权限",           suggestion: "请确认 API Key 是否有权访问该模型，或检查 API 套餐权限", retryable: false },
  "429":         { message: "请求频率过高，已被限流", suggestion: "请稍后重试，或联系 API 提供商升级套餐", retryable: true },
  "500":         { message: "API 服务端错误",       suggestion: "第三方 API 暂时不可用，请稍后重试", retryable: true },
  "502":         { message: "API 网关错误",         suggestion: "第三方 API 网关暂时异常，请稍后重试", retryable: true },
  "503":         { message: "API 服务暂不可用",     suggestion: "第三方 API 正在维护或过载，请稍后重试", retryable: true },
};

export function diagnoseError(raw: unknown): ErrorDiagnostic;
```

**验收标准：**
- 所有 `NETWORK_ERRORS` 中的错误码都有对应的中文消息和建议
- `diagnoseError()` 对未知错误返回通用中文提示，不返回英文原文
- 错误消息长度不超过 50 个中文字符

**测试要点：**
- `errorDiagnostics.test.ts` — 每个错误码的映射正确性；未知错误的降级行为

---

#### B4. 设置面板连接状态指示器

**目标：** 在 `SettingsPanel.tsx` 中展示连接状态，使用 `ActivityIndicator` 组件的四种状态样式，错误时展开详情。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `src/app/components/SettingsPanel.tsx` | 修改 — 新增连接状态指示器 |
| `src/app/components/SettingsPanel.test.tsx` | 修改 — 新增状态指示器测试 |
| `src/app/sdkEventStore.ts` | 修改 — 新增 `connectionStatus` state + reducer case |
| `src/app/sdkUiTypes.ts` | 修改 — `SdkUiState` 新增 `connectionStatus` |

**UI 规格：**

- 位置：设置面板顶部，Base URL 输入框上方
- 状态指示器：`ActivityIndicator` 组件复用
  - `connected` → `.done` 绿色 `#788c5d`，文字"已连接"
  - `unverified` → `.idle` 灰色 `#c5c1b9`，文字"未验证"
  - `connecting` → `.active` 脉动赤陶色 `#d97757`，文字"验证中..."
  - `failed` → `.error` 红色 `#c4554d`，文字"连接失败"
- 失败状态可点击展开 → 显示 `error.message` + `error.suggestion`
- 展开区域背景 `var(--bg-card)`，边框 `var(--border-subtle)`，字号 12px
- 旁边有"测试连接"按钮（12px `var(--text-secondary)`）

**Playwright E2E 验收：**

文件：`tests/e2e/connection-status.spec.ts`

```typescript
// 场景 1：错误 baseUrl → 红色指示器 + 错误详情
test("shows error status with invalid base URL", async ({ page }) => {
  await page.goto("/");
  // 打开设置面板
  await page.getByRole("button", { name: "设置" }).click();
  // 输入错误的 baseUrl
  await page.getByPlaceholder("https://api.anthropic.com").fill("https://invalid.example.com");
  // 触发保存/测试连接
  await page.getByRole("button", { name: "测试连接" }).click();
  // 断言红色指示器
  await expect(page.locator(".activity-indicator.error")).toBeVisible();
  // 点击展开
  await page.locator(".connection-error-detail").click();
  // 断言中文错误消息
  await expect(page.getByText("无法解析 API 地址")).toBeVisible();
  await expect(page.getByText("请检查 Base URL 是否正确")).toBeVisible();
});
```

---

### C. 模型能力检测与自动降级

#### C1. 模型能力检测接口

**背景：** 第三方 API 背后的模型（特别是国产模型如 DeepSeek、Qwen、GLM 等）对 Anthropic 扩展特性的支持程度不一致。例如：并非所有模型都支持 extended thinking，许多模型不支持 `cache_control`。当前无检测机制，用户开启不支持的功能后直接收到 API 错误。

**目标：** 建立模型能力检测引擎，在首次使用某个模型时（或缓存过期后）通过试探性请求探测其能力。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/modelCapabilities.ts` | **新建** — 能力检测引擎 |

**接口类型定义草案：**

```typescript
// electron/agent/modelCapabilities.ts

export type ModelCapabilities = {
  model: string;
  supportsThinking: boolean;       // 是否支持 extended thinking
  supportsJsonSchema: boolean;     // 是否支持 JSON Schema 约束输出
  supportsPromptCaching: boolean;  // 是否支持 cache_control
  maxContextWindow: number;        // 最大上下文 tokens（默认 200000）
  supportsToolUse: boolean;        // 是否支持 tool use（基本都支持）
  detectedAt: number;              // Unix 时间戳（毫秒）
  detectionMethod: "probe" | "heuristic" | "manual";
};

// 检测策略：
// 1. supportsToolUse → 发送最小 tool_use 试探请求，成功则 true
// 2. supportsThinking → 发送 thinking={type:"enabled",budgetTokens:1024} 试探，成功则 true
// 3. supportsJsonSchema → 发送 outputFormat 试探，成功则 true
// 4. supportsPromptCaching → 检查试探请求的响应是否包含 cache 相关 usage 字段
// 5. maxContextWindow → 从 API 响应头或已知模型表获取
export function detectModelCapabilities(
  sdk: { query: QueryFunction },
  model: string
): Promise<ModelCapabilities>;
```

**时序图：**

```
AgentSessionManager         modelCapabilities           第三方API
      │                           │                         │
      │  startRun(model)          │                         │
      │──────────────────────────→│                         │
      │                           │  试探性请求 (thinking)   │
      │                           │────────────────────────→│
      │                           │←──── 200 / 400 ────────│
      │                           │                         │
      │                           │  试探性请求 (jsonSchema) │
      │                           │────────────────────────→│
      │                           │←──── 200 / 400 ────────│
      │                           │                         │
      │                           │  试探性请求 (cache)      │
      │                           │────────────────────────→│
      │                           │←── usage.cache_read ────│
      │                           │                         │
      │←── ModelCapabilities ────│                         │
      │                           │                         │
```

**验收标准：**
- 首次检测到模型能力后缓存，后续使用缓存值（不重复探测）
- 探测失败不阻塞对话启动，标记为 heuristic 降级
- 单一维度探测失败不影响其他维度的检测结果

**测试要点：**
- `modelCapabilities.test.ts` — 模拟 SDK 响应，覆盖全部能力组合（4 种布尔排列 + 未知模型降级）

---

#### C2. 能力检测结果缓存

**目标：** 将检测结果持久化，避免每次启动重新探测。支持手动刷新。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/modelCapabilities.ts` | 修改 — 缓存读写逻辑 |

**缓存文件格式（`.claude/model-capabilities.json`）：**

```json
{
  "version": 1,
  "entries": {
    "claude-sonnet-4-6": {
      "model": "claude-sonnet-4-6",
      "supportsThinking": true,
      "supportsJsonSchema": true,
      "supportsPromptCaching": true,
      "maxContextWindow": 200000,
      "supportsToolUse": true,
      "detectedAt": 1717200000000,
      "detectionMethod": "probe"
    },
    "deepseek-v3": {
      "model": "deepseek-v3",
      "supportsThinking": false,
      "supportsJsonSchema": false,
      "supportsPromptCaching": false,
      "maxContextWindow": 128000,
      "supportsToolUse": true,
      "detectedAt": 1717200000000,
      "detectionMethod": "probe"
    }
  }
}
```

- TTL = 24 小时（配置项，可调整）
- 缓存未命中时自动触发检测
- 设置面板提供"重新检测"按钮强制刷新

---

#### C3. 设置面板能力感知

**目标：** 在 `SettingsPanel.tsx` 中，根据当前模型的能力检测结果，灰显不支持的配置项并给出 tooltip 说明。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `src/app/components/SettingsPanel.tsx` | 修改 — 能力感知逻辑 |
| `src/app/components/SettingsPanel.test.tsx` | 修改 — 能力感知测试 |
| `src/app/sdkEventStore.ts` | 修改 — 新增 `modelCapabilities` state |

**UI 规格：**

- 不支持 thinking → thinking effort/display 选项灰显 + tooltip "当前模型不支持扩展思考"
- 不支持 JSON Schema → 结构化输出开关灰显 + tooltip "当前模型不支持 JSON Schema 输出"
- 不支持 caching → Prompt 缓存开关灰显 + tooltip "当前模型不支持 Prompt Caching"
- 灰显样式：`opacity: 0.4; pointer-events: none; cursor: not-allowed`
- tooltip 使用 HTML `title` 属性或自定义 tooltip

**Playwright E2E 验收：**

文件：`tests/e2e/model-capabilities.spec.ts`

```typescript
// 场景 1：切换到支持 thinking 的模型 → 选项可操作
test("enables thinking options for capable model", async ({ page }) => {
  // 选择支持 thinking 的模型
  // 断言 thinking effort 下拉可交互
  await expect(page.getByLabel("思考强度")).toBeEnabled();
});

// 场景 2：切换到不支持 thinking 的模型 → 选项灰显
test("disables thinking options for incapable model", async ({ page }) => {
  // 选择 deepseek-v3
  // 断言 thinking effort 下拉灰显
  await expect(page.getByLabel("思考强度")).toBeDisabled();
  // hover 显示 tooltip
  await page.getByLabel("思考强度").hover();
  await expect(page.getByText("当前模型不支持扩展思考")).toBeVisible();
});
```

---

#### C4. 运行时自动降级

**目标：** 在 `loadAgentRuntimeConfig()` 中根据模型能力自动移除不支持的 SDK options，确保不向第三方 API 发送无效参数。降级行为通知前端。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentConfig.ts` | 修改 — `loadAgentRuntimeConfig` 中增加降级逻辑 |

**降级规则表：**

| 检测结果 | 降级行为 |
|----------|----------|
| `supportsThinking = false` | 删除 `sdkOptions.thinking`、`sdkOptions.effort` |
| `supportsJsonSchema = false` | 删除 `sdkOptions.outputFormat`，从 schema 提取字段注入 system prompt |
| `supportsPromptCaching = false` | 删除 `sdkOptions.promptCaching` |
| `supportsToolUse = false` | 删除自定义工具，删除 MCP servers，通过 `sdk:system-event` 发出严重警告 |

**降级通知：**

降级发生时通过已有的 `sdk:system-event` 通道（subtype: `"capability_degraded"`）发送通知：

```typescript
// payload
{
  type: "sdk:system-event",
  subtype: "capability_degraded",
  raw: {
    model: "deepseek-v3",
    degradations: [
      { feature: "thinking", reason: "模型不支持" },
      { feature: "jsonSchema", reason: "模型不支持，已降级为自然语言格式要求" },
    ]
  }
}
```

UI 展示：对话开始时在消息流顶部显示黄色信息横幅（使用 `--accent` 色，`ActivityIndicator` idle 状态），内容为"当前模型不支持以下功能：扩展思考、JSON Schema 输出。已自动调整为兼容模式。"不可关闭，不阻塞对话。

**⚠️ IPC 同步检查清单（新增 `sdk:system-event` subtype）：**
- `src/ipc/channels.ts` — 无需变更
- `src/ipc/payloadSchemas.ts` — `sdk:system-event` Zod schema 的 `subtype` 枚举扩展 `"capability_degraded"`
- `src/app/backendBridge.ts` — 无需变更
- `electron/preload.ts` — 无需变更
- `electron/preloadApi.ts` — 无需变更
- `npm test -- src/ipc/payloadSchemas.test.ts electron/agent/agentConfig.test.ts`
- `npm run build`

**验收标准：**
- 降级后 `sdkOptions` 中不含不支持特性的配置项
- `sdk:system-event(subtype: "capability_degraded")` 正确发送
- 降级不阻塞对话启动

---

### J. 第三方 API 特殊处理

#### J1. 第三方 API 响应格式兼容

**背景：** 不同第三方 API 提供商的响应格式存在差异。例如：部分厂商返回 `total_tokens` 而非 `input_tokens + output_tokens`；usage 字段可能嵌套在不同层级；rate-limit 信息格式各异。

**目标：** 在 `runEventMapper.ts` 和 `sdkEventStore.ts` 的 `normalizeUsage()` 中增加对常见第三方 API 响应格式的兼容处理。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `src/app/sdkEventStore.ts` | 修改 — `normalizeUsage()` 扩展第三方兼容逻辑 |
| `electron/agent/runEventMapper.ts` | 修改 — result 消息处理中增加第三方字段探测 |

**兼容处理规则：**

```typescript
// normalizeUsage() 扩展
function normalizeUsage(raw: unknown): TokenUsage {
  // ... 现有逻辑 ...

  // 兼容 1：total_tokens 替代分项
  if (!hasInputOutput && typeof r.total_tokens === "number") {
    r.input_tokens = Math.round(r.total_tokens * 0.75);
    r.output_tokens = Math.round(r.total_tokens * 0.25);
  }

  // 兼容 2：嵌套 usage（response.usage）
  if (!r.input_tokens && r.response?.usage) {
    r = { ...r, ...r.response.usage };
  }

  // 兼容 3：prompt_tokens / completion_tokens（OpenAI 风格字段名）
  if (!r.input_tokens && typeof r.prompt_tokens === "number") {
    r.input_tokens = r.prompt_tokens;
  }
  if (!r.output_tokens && typeof r.completion_tokens === "number") {
    r.output_tokens = r.completion_tokens;
  }

  // ... 继续现有 normalize 逻辑 ...
}
```

**验收标准：**
- 使用 `total_tokens` 格式的 API → input/output tokens 按 3:1 估算显示
- 使用 `prompt_tokens/completion_tokens` 格式的 API → 正确映射
- 未知格式 → 不崩溃，`inputTokens/outputTokens` 为 0

**测试要点：**
- `sdkEventStore.test.ts` — 覆盖 3 种第三方格式变体 + 未知格式降级

---

#### J2. `accountInfo()` 替换

**背景：** SDK 的 `accountInfo()` 返回 Anthropic 账户信息（email、organization、subscriptionType、apiProvider）。在使用第三方 API 时这些信息无意义。

**目标：** 在 `AgentSessionManager.accountInfo()` 中拦截 SDK 返回，替换为第三方 API 的实际信息。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentSessionManager.ts` | 修改 — `accountInfo()` 方法中替换返回值 |

**替换逻辑：**

```typescript
async accountInfo(runId: string) {
  const raw = await this.session(runId).accountInfo();
  const config = await this.loadConfig({ cwd: this.deps.cwd ?? process.cwd() });
  return {
    endpoint: config.sdkOptions.baseUrl ?? (config.sdkOptions.env as any)?.ANTHROPIC_BASE_URL,
    model: config.sdkOptions.model ?? (config.sdkOptions.env as any)?.ANTHROPIC_MODEL,
    provider: "third_party",
    // 保留 SDK 返回的 apiProvider 仅用于诊断
    sdkApiProvider: raw.apiProvider,
  };
}
```

**UI 展示：** 设置面板或信息区域中：
- 显示"第三方 API"标记 + 端点 URL
- 不显示 email/organization/subscriptionType 等 Anthropic 特有字段

---

#### J3. `initializationResult()` 替换

**背景：** SDK 的 `initializationResult()` 返回 Anthropic 特定的初始化状态。需要使用连接验证结果替换。

**目标：** 在 `AgentSessionManager.initializationResult()` 中替换为连接验证结果。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentSessionManager.ts` | 修改 — `initializationResult()` 方法中替换返回值 |

**替换后返回格式：**

```typescript
async initializationResult(runId: string) {
  // 复用 B1 的连接探测结果
  const connectionStatus = await this.getConnectionStatus();
  return {
    endpoint: connectionStatus.baseUrl,
    authenticated: connectionStatus.state === "connected",
    model: connectionStatus.model,
    provider: "third_party",
  };
}
```

**Playwright E2E 验收：**

文件：`tests/e2e/third-party-compat.spec.ts`

```typescript
test("shows third-party API info instead of Anthropic account", async ({ page }) => {
  await page.goto("/");
  // 打开设置面板
  await page.getByRole("button", { name: "设置" }).click();
  // 断言不显示 Anthropic 字段
  await expect(page.getByText(/organization/i)).toHaveCount(0);
  await expect(page.getByText(/subscription/i)).toHaveCount(0);
  // 断言显示第三方 API 信息
  await expect(page.getByText("第三方 API")).toBeVisible();
  // 断言端点 URL 可见
  await expect(page.getByText(/https:\/\//)).toBeVisible();
});
```

---

## 五、阶段二：功能适配层（11 tasks）

### D. 结构化输出（`outputFormat`）

#### D1. `outputFormat` 配置暴露

**背景：** SDK 的 `outputFormat` 选项允许约束模型按 JSON Schema 输出结构化数据。对 AI 测试助手的核心场景（测试计划生成、缺陷报告创建）价值极高。当前 `UserSdkOptions` 中未声明此字段。

**目标：** 在 `UserSdkOptions`、配置合并链和设置面板中完整暴露 `outputFormat`。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentConfig.ts` | 修改 — `UserSdkOptions` 新增 `outputFormat` + `sanitizeUserSdkOptions` 校验 |
| `electron/agent/agentConfig.ts` | 修改 — `loadAgentRuntimeConfig` 合并到 `sdkOptions` |
| `src/ipc/payloadSchemas.ts` | 修改 — `run:apply-settings` schema 扩展 |
| `electron/agent/agentSessionManager.ts` | 无需变更 — `applySettings()` 已透传 |
| `electron/preload.ts` | 无需变更 |
| `electron/preloadApi.ts` | 无需变更 |

**类型草案：**

```typescript
// UserSdkOptions 中新增
outputFormat?: {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
};
```

**`sanitizeUserSdkOptions` 校验规则：**
- `outputFormat` 必须是对象
- `outputFormat.type` 必须为 `"json_schema"`
- `outputFormat.json_schema.name` 必须为非空字符串
- `outputFormat.json_schema.schema` 必须为非空对象且可被 `JSON.stringify`

**⚠️ IPC 同步检查清单：**
- `src/ipc/payloadSchemas.ts` — `run:apply-settings` Zod schema 扩展 `outputFormat: z.object({...}).optional()`
- `src/app/backendBridge.ts` — `applySettings()` 参数类型扩展 `outputFormat`
- `npm test -- src/ipc/payloadSchemas.test.ts electron/agent/agentConfig.test.ts`
- `npm run build`

---

#### D2. 预设 JSON Schema 模板

**目标：** 为 AI 测试助手的核心场景提供预设 JSON Schema 模板，用户可在设置面板中直接选择。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `src/domain/outputSchemas.ts` | **新建** — 预设模板定义 |

**模板定义：**

```typescript
// src/domain/outputSchemas.ts

export type OutputSchemaTemplate = {
  id: string;
  label: string;         // 中文标签
  description: string;   // 中文描述
  outputFormat: {        // 可直接传给 SDK 的格式
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
};

export const OUTPUT_SCHEMA_TEMPLATES: OutputSchemaTemplate[] = [
  {
    id: "test_plan",
    label: "测试计划",
    description: "生成包含步骤、预期结果和优先级的结构化测试计划",
    outputFormat: {
      type: "json_schema",
      json_schema: {
        name: "test_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            planName: { type: "string", description: "测试计划名称" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  stepId: { type: "string" },
                  title: { type: "string" },
                  expectedResult: { type: "string" },
                  priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
                },
                required: ["stepId", "title", "expectedResult"],
              },
            },
          },
          required: ["planName", "steps"],
        },
      },
    },
  },
  {
    id: "bug_report",
    label: "缺陷报告",
    description: "生成包含标题、严重程度、复现步骤的结构化缺陷报告",
    outputFormat: {
      type: "json_schema",
      json_schema: {
        name: "bug_report",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "缺陷标题" },
            severity: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
            stepsToReproduce: { type: "array", items: { type: "string" } },
            expectedBehavior: { type: "string" },
            actualBehavior: { type: "string" },
            evidenceIds: { type: "array", items: { type: "string" } },
          },
          required: ["title", "severity", "stepsToReproduce", "expectedBehavior", "actualBehavior"],
        },
      },
    },
  },
  {
    id: "evidence_summary",
    label: "测试证据摘要",
    description: "生成包含截图、API 响应、数据库记录等证据的结构化摘要",
    outputFormat: {
      type: "json_schema",
      json_schema: {
        name: "evidence_summary",
        strict: true,
        schema: {
          type: "object",
          properties: {
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "证据 ID" },
                  title: { type: "string", description: "证据标题" },
                  type: { type: "string", enum: ["screenshot", "api_response", "database_record", "log", "dom"], description: "证据类型" },
                  summary: { type: "string", description: "证据摘要" },
                  uri: { type: "string", description: "证据文件 URI" },
                },
                required: ["id", "title", "type", "summary"],
              },
            },
          },
          required: ["evidence"],
        },
      },
    },
  },
  {
    id: "custom",
    label: "自定义 Schema",
    description: "手动输入自定义 JSON Schema",
    outputFormat: null, // 用户自行填写
  },
];
```

---

#### D3. 设置面板 outputFormat 配置

**目标：** 在 `SettingsPanel.tsx` 的"高级设置"折叠区域中新增结构化输出配置。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `src/app/components/SettingsPanel.tsx` | 修改 — 新增 outputFormat 配置区块 |

**UI 规格：**

- 位于"高级设置"折叠区域第二行（在权限模式等基础 SDK 设置之后）
- 开关：`role="switch"`，标签"结构化输出"，副标题"让 AI 按指定 JSON 格式输出"
- 模板下拉：`role="combobox"`，选项为 `OUTPUT_SCHEMA_TEMPLATES` 的 label
- 自定义 Schema 文本区域：
  - 仅当选"自定义 Schema"时显示
  - `font-family: var(--font-mono)`（JetBrains Mono）
  - `min-height: 120px`
  - `border-radius: var(--radius-sm)`
  - focus `border-color: var(--accent)`
  - 内容为合法 JSON 时边框变绿（`var(--green)`），非法时变红（`var(--red)`）
- 能力不支持时灰显 + tooltip "当前模型不支持 JSON Schema 输出"
- 动画：模板切换时自定义 Schema 区域的显示/隐藏使用 `--transition-fast`

**Playwright E2E 验收：**

文件：`tests/e2e/structured-output.spec.ts`

```typescript
test("selects test plan template and sends request", async ({ page }) => {
  await page.goto("/");
  // 打开设置
  await page.getByRole("button", { name: "设置" }).click();
  // 展开高级设置
  await page.getByText("高级设置").click();
  // 开启结构化输出
  await page.getByRole("switch", { name: "结构化输出" }).click();
  // 选择测试计划模板
  await page.getByRole("combobox", { name: "输出模板" }).selectOption("测试计划");
  // 发送对话
  await page.getByLabel("消息输入").fill("测试订单模块");
  await page.getByRole("button", { name: "发送" }).click();
  // 等待响应完成
  // 断言 Agent 输出为结构化 JSON 卡片
  await expect(page.locator(".structured-output-card")).toBeVisible();
});
```

---

#### D4. 结构化输出降级方案

**目标：** 当模型不支持 JSON Schema 时，自动从 schema 中提取字段信息注入 system prompt。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentConfig.ts` | 修改 — `loadAgentRuntimeConfig` 降级逻辑 |

**降级策略：**

```typescript
function degradeOutputFormatToPrompt(outputFormat: OutputFormatConfig): string {
  const schema = outputFormat.json_schema.schema;
  const fields = extractFields(schema);  // 递归提取 property 名和 description
  return [
    "请以 JSON 格式输出，必须包含以下字段：",
    ...fields.map(f => `- ${f.name}: ${f.description ?? ""} (${f.type})`),
    "",
    "以 ```json ... ``` 代码块包裹 JSON 输出。",
  ].join("\n");
}
```

降级通知通过 `sdk:system-event` (subtype: `"capability_degraded"`) 发送。

---

### F. Prompt Caching 控制

#### F1. `promptCaching` 配置暴露

**背景：** SDK 的 `promptCaching` 选项启用后，会在 API 请求中注入 `cache_control` 标记，使重复的上下文（system prompt、工具定义等）被缓存，大幅降低长会话的 token 消耗。对测试助手场景（长对话、复杂测试流程）价值很高。

当前状态：
- `UserSdkOptions.promptCaching` 已声明类型（`agentConfig.ts` 第 38 行）
- `sanitizeUserSdkOptions` 中无对应的赋值逻辑 → 配置被静默丢弃
- `loadAgentRuntimeConfig` 中未传递到 `sdkOptions`
- 设置面板未暴露

**目标：** 补全 `promptCaching` 从设置面板到 SDK options 的完整链路。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentConfig.ts` | 修改 — `sanitizeUserSdkOptions` 增加 `promptCaching` 赋值；`loadAgentRuntimeConfig` 传递 |
| `electron/agent/sdkSettings.ts` | 修改 — `SettingsFormValues` 新增 `promptCaching`；持久化 |
| `src/app/components/SettingsPanel.tsx` | 修改 — 新增开关 |
| `src/ipc/payloadSchemas.ts` | 修改 — `settings:save` schema 扩展 |

**⚠️ IPC 同步检查清单：**
- `src/ipc/channels.ts` — 无需变更
- `src/ipc/payloadSchemas.ts` — `settings:save` Zod schema 扩展 `promptCaching: z.boolean().optional()`
- `src/app/backendBridge.ts` — `SettingsFormValues` 类型扩展 `promptCaching?: boolean`
- `electron/main.ts` — `settings:save` handler 透传新字段
- `electron/preload.ts` — 无需变更
- `electron/preloadApi.ts` — 无需变更
- `npm test -- src/ipc/payloadSchemas.test.ts electron/agent/sdkSettings.test.ts`
- `npm run build`

---

#### F2. 缓存命中率监控

**目标：** 在 UI 中展示 Prompt 缓存的命中率，帮助用户判断缓存配置是否有效。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `src/app/sdkUiTypes.ts` | 修改 — `TokenUsage` 新增 `cacheHitRate?: number` |
| `src/app/sdkEventStore.ts` | 修改 — `sdk:usage` 处理中计算缓存命中率 |
| `src/app/components/MessageStream.tsx` | 修改 — 状态栏中展示命中率 |

**计算逻辑：**

```typescript
function computeCacheHitRate(usage: TokenUsage): number | undefined {
  const read = usage.cacheReadInputTokens ?? 0;
  const create = usage.cacheCreationInputTokens ?? 0;
  const total = usage.inputTokens;
  if (total === 0) return undefined;
  return Math.round((read / total) * 100);
}
```

**UI 规格：**

- 展示位置：对话面板底部状态区域（与模型名、token 用量同行）
- 仅当 `promptCaching` 启用且存在缓存读取时显示
- 格式：`缓存命中率：45%`（11px `var(--text-tertiary)`，等宽字体）
- 命中率 < 20% → 颜色变为 `var(--accent)` + tooltip "命中率偏低，检查系统提示是否频繁变动"
- 命中率 ≥ 80% → 颜色变为 `var(--green)`

---

### G. `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 使用

#### G1. 系统提示动态段标记

**背景：** SDK 导出的 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 是一个字符串常量标记，用于在 system prompt 中划分静态段（可被缓存）和动态段（每次请求变化）。当前已从 facade 导出但从未在任何业务代码中使用。

**目标：** 在构造 system prompt 时使用此标记，最大化 Prompt Caching 的缓存命中率。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/systemPromptBuilder.ts` | **新建** — system prompt 构造器 |
| `electron/agent/agentConfig.ts` | 修改 — 调用 builder 构造 system prompt |

**类型草案：**

```typescript
// electron/agent/systemPromptBuilder.ts

import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from "./claudeAgentSdkFacade.js";

export type SystemPromptContext = {
  staticParts: string[];     // 静态段（角色定义、行为规范、工具说明等）
  dynamicContext: {
    currentTime: string;     // 当前时间
    userName: string;        // 用户名
    projectName: string;     // 项目名
    environmentName: string; // 环境名
    sessionId: string;       // 会话 ID
  };
};

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const staticBlock = ctx.staticParts.join("\n\n");
  const dynamicBlock = [
    `当前时间：${ctx.dynamicContext.currentTime}`,
    `用户：${ctx.dynamicContext.userName}`,
    `项目：${ctx.dynamicContext.projectName}`,
    `测试环境：${ctx.dynamicContext.environmentName}`,
    `会话：${ctx.dynamicContext.sessionId}`,
  ].join("\n");

  return [staticBlock, SYSTEM_PROMPT_DYNAMIC_BOUNDARY, dynamicBlock].join("\n");
}
```

**验收标准：**
- 构造的 system prompt 包含 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 标记
- 静态段在多次请求间保持不变
- 动态段随请求上下文更新

**测试要点：**
- `systemPromptBuilder.test.ts` — 标记位置正确、静态段/动态段分离正确

---

#### G2. 动态内容注入策略

**目标：** 在 `AgentSessionManager.startRun()` 中调用 `buildSystemPrompt()`，将结果注入 `sdkOptions.systemPrompt`。当用户切换项目/环境时动态段更新，静态段维持不变以保持缓存命中。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentSessionManager.ts` | 修改 — `startRun()` 中调用 builder |
| `electron/agent/agentConfig.ts` | 修改 — `loadAgentRuntimeConfig` 中使用合并后的 systemPrompt |

**Playwright E2E 验收：**

文件：`tests/e2e/dynamic-system-prompt.spec.ts`

```typescript
test("system prompt boundary maintains cache across context switches", async ({ page }) => {
  await page.goto("/");
  // 发送第一条消息
  await page.getByLabel("消息输入").fill("测试登录功能");
  await page.getByRole("button", { name: "发送" }).click();
  // 等待响应
  // 切换项目/环境后发送第二条消息
  // 验证 usage.cacheReadInputTokens > 0（静态段被缓存命中）
});
```

---

### H. 自定义工具定义（`tool()` / `createSdkMcpServer`）

#### H1. 测试领域自定义工具

**背景：** SDK 的 `tool()` 函数允许应用定义自定义工具，Agent 可通过 tool use 调用。当前 `tool` 已从 facade 导出（`claudeAgentSdkFacade.ts` 第 5-7 行）但从未在业务代码中调用。

**目标：** 使用 `tool()` 定义 AI 测试助手的领域专用工具。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/customTools.ts` | **新建** — 自定义工具定义 |

**工具定义草案：**

```typescript
// electron/agent/customTools.ts

import { tool } from "./claudeAgentSdkFacade.js";
import { z } from "zod/v4";

// 工具 1：生成测试报告
export const generateTestReportTool = tool(
  "generate_test_report",
  "生成一份结构化的测试报告，包含测试步骤执行结果、通过/失败统计和证据链接。在测试执行完成后调用。",
  {
    title: z.string().describe("报告标题"),
    steps: z.array(z.object({
      name: z.string().describe("测试步骤名称"),
      status: z.enum(["passed", "failed", "blocked"]).describe("执行结果"),
      evidence: z.string().optional().describe("证据 ID 或链接"),
      notes: z.string().optional().describe("备注"),
    })).describe("测试步骤列表"),
    summary: z.string().describe("测试结论摘要"),
    totalPassed: z.number().int().min(0).describe("通过数"),
    totalFailed: z.number().int().min(0).describe("失败数"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify({ ...args, generatedAt: Date.now() }, null, 2) }],
  })
);

// 工具 2：创建缺陷草稿
export const createBugDraftTool = tool(
  "create_bug_draft",
  "创建一个缺陷草稿。在测试发现异常行为或断言失败时调用。",
  {
    title: z.string().describe("缺陷标题"),
    severity: z.enum(["P0", "P1", "P2", "P3"]).describe("严重程度"),
    stepsToReproduce: z.array(z.string()).describe("复现步骤"),
    expectedBehavior: z.string().describe("期望行为"),
    actualBehavior: z.string().describe("实际行为"),
    evidenceIds: z.array(z.string()).optional().describe("关联证据 ID 列表"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify({ ...args, status: "draft", createdAt: Date.now() }, null, 2) }],
  })
);

// 工具 3：记录测试证据
export const captureEvidenceTool = tool(
  "capture_evidence",
  "记录一条测试证据，可以是截图、API 响应、数据库查询结果或日志片段。",
  {
    title: z.string().describe("证据标题"),
    evidenceType: z.enum(["screenshot", "api_response", "database_record", "log", "dom"]).describe("证据类型"),
    summary: z.string().describe("证据摘要描述"),
    uri: z.string().optional().describe("证据文件 URI"),
    metadata: z.record(z.unknown()).optional().describe("额外元数据"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify({ ...args, id: crypto.randomUUID(), capturedAt: Date.now() }, null, 2) }],
  })
);

export const customTools = [
  generateTestReportTool,
  createBugDraftTool,
  captureEvidenceTool,
];
```

**验收标准：**
- 每个工具有清晰的中文 name 和 description
- 每个工具使用 Zod schema 定义输入参数
- 工具结果可序列化为 JSON 并通过 `RunEvent` 反馈到 UI

**测试要点：**
- `customTools.test.ts` — 工具定义有效性（name/description/schema/handler 齐全）

---

#### H2. 自定义工具注册机制

**目标：** 在 `loadAgentRuntimeConfig()` 中将自定义工具注入 `sdkOptions.tools`，并支持用户通过配置扩展。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentConfig.ts` | 修改 — `loadAgentRuntimeConfig` 中合并自定义工具 |

```typescript
// loadAgentRuntimeConfig 中
const mergedTools = [
  ...(userSdkOptions.tools ?? []),  // 用户通过设置配置的工具
  ...customTools,                    // 应用内置工具
];

return {
  ...base,
  sdkOptions: {
    ...merged,
    tools: mergedTools.length > 0 ? mergedTools : undefined,
  },
};
```

---

#### H3. 应用内 MCP 服务器

**背景：** SDK 的 `createSdkMcpServer()` 允许将应用自身注册为 MCP Server，Agent 可通过 MCP 协议调用应用暴露的能力。当前已从 facade 导出但从未使用。

**目标：** 将应用暴露为 MCP Server，提供测试数据库查询、截图捕获等能力。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/appMcpServer.ts` | **新建** — 应用 MCP Server 定义 |

**MCP Server 定义草案：**

```typescript
// electron/agent/appMcpServer.ts

import { createSdkMcpServer } from "./claudeAgentSdkFacade.js";
import { z } from "zod/v4";

export const appMcpServer = createSdkMcpServer({
  name: "ai-test-assistant",
  version: "0.1.0",
  // MCP Server 的工具在 SDK 层面通过 tool() 定义，
  // createSdkMcpServer 提供 server 实例供 SDK 管理连接生命周期
});
```

在 `loadAgentRuntimeConfig()` 中注册：

```typescript
if (appMcpServer) {
  mergedOptions.mcpServers = {
    ...(mergedOptions.mcpServers ?? {}),
    "ai-test-assistant": appMcpServer,
  };
}
```

**Playwright E2E 验收：**

文件：`tests/e2e/custom-tools.spec.ts`

```typescript
test("agent calls generate_test_report tool", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("消息输入").fill("测试登录功能并生成测试报告");
  await page.getByRole("button", { name: "发送" }).click();
  // 等待工具调用卡片出现
  await expect(page.getByText("generate_test_report")).toBeVisible();
  // 等待工具结果
  await expect(page.getByText("通过数")).toBeVisible();
});
```

---

## 六、阶段三：运维增强层（6 tasks）

### I. 自定义进程管理（`spawnClaudeCodeProcess`）

#### I1. 进程生命周期钩子

**背景：** SDK 的 `spawnClaudeCodeProcess` 回调允许应用接管 Claude Code 子进程的创建和管理。第三方 API 的稳定性通常不如 Anthropic 官方，进程管理尤为重要。当前类型已在 `agentConfig.ts`（`codeOptions`）中声明但未实现。

**目标：** 实现 `spawnClaudeCodeProcess` 回调，支持进程崩溃自动重启。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/processManager.ts` | **新建** — 进程管理器 |

**类型草案：**

```typescript
// electron/agent/processManager.ts

export type ProcessState = {
  pid: number | null;
  status: "starting" | "running" | "stopping" | "stopped" | "crashed";
  startedAt: number;
  restartCount: number;
  lastError?: string;
};

export type ProcessManagerOptions = {
  maxRestarts: number;          // 最大自动重启次数（默认 3）
  restartBackoffMs: number;     // 重启退避基础时间（默认 2000，指数增长）
  onStateChange: (state: ProcessState) => void;
};

export function createProcessManager(options: ProcessManagerOptions): {
  spawn: (opts: SpawnOptions) => SpawnedProcess;  // 传给 SDK 的 spawnClaudeCodeProcess
  getState: () => ProcessState;
  shutdown: (timeoutMs: number) => Promise<void>;
};
```

**重启策略：**
- 第 N 次崩溃 → 等待 `restartBackoffMs * 2^(N-1)` 后重启
- 超过 `maxRestarts` → 不再重启，通过 IPC 通知前端
- 正常关闭（用户主动停止）不计入重启次数

---

#### I2. 进程健康监控

**目标：** 定期检查子进程状态，异常时通过 IPC 通知渲染进程展示用户可见提示。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/processManager.ts` | 修改 — 健康检查逻辑 |
| `electron/agent/agentSessionManager.ts` | 修改 — `drainMessages()` 中接收进程状态变更 |
| `src/ipc/payloadSchemas.ts` | 修改 — `sdk:system-event` subtype 扩展 |

**UI 规格：**

- 崩溃重连中：黄色横幅，`ActivityIndicator(.active)` 脉动，`--accent` 色文字 "Agent 进程异常，正在自动恢复 (第 2 次尝试)..."
- 恢复成功：横幅自动消失
- 恢复失败（超过 maxRestarts）：红色横幅，`ActivityIndicator(.error)`，"Agent 进程无法恢复。请检查 API 配置、网络连接后重启应用。"

横幅类型复用已有 `sdk:system-event` 通道，subtype 为 `"process_health"`。

**⚠️ IPC 同步检查清单：**
- `src/ipc/payloadSchemas.ts` — `sdk:system-event` subtype 枚举扩展 `"process_health"`
- 其他文件无需变更（`sdk:system-event` 通道和 payload 已存在）
- `npm test -- src/ipc/payloadSchemas.test.ts`
- `npm run build`

---

#### I3. 优雅关闭

**目标：** 增强 `main.ts` 的 `before-quit` 处理，支持多 session 并发场景的优雅关闭。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/main.ts` | 修改 — `before-quit` 处理增强 |

**流程：**

```
app.on("before-quit")
  │
  ├─→ 1. 阻止默认退出
  ├─→ 2. 遍历所有活跃 AgentSession，发送 close()
  ├─→ 3. processManager.shutdown(5000) — 等待子进程退出
  ├─→ 4. warmQuery[Symbol.asyncDispose]() — 已有逻辑
  └─→ 5. app.quit()
```

**Playwright E2E 验收：**

文件：`tests/e2e/process-management.spec.ts`

```typescript
test("shows recovery banner on simulated crash", async ({ page }) => {
  // 依赖 Playwright 的 route 拦截模拟崩溃
  // 场景 1：模拟进程崩溃 → 黄色横幅出现
  // 场景 2：自动恢复成功 → 横幅消失
  // 场景 3：模拟连续崩溃超过阈值 → 红色错误横幅出现
});
```

---

### L. 错误处理与日志

#### L1. 第三方 API 特有错误码处理

**背景：** 第三方 API 可能返回 Anthropic 标准之外的错误码。B3 已建立基础错误映射表，L1 在此之上扩展**第三方 API 特有**的错误码。

**目标：** 在 `errorDiagnostics.ts`（B3 同文件）中扩展第三方特有错误码映射。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/errorDiagnostics.ts` | 修改 — 新增第三方特有错误码 |

**新增映射：**

```typescript
export const THIRD_PARTY_ERRORS: Record<string, ErrorDiagnostic> = {
  "insufficient_balance":         { message: "API 余额不足", suggestion: "请联系第三方 API 提供商充值", retryable: false },
  "model_not_found":              { message: "模型不可用", suggestion: "请检查模型名称是否正确，或确认 API 套餐是否包含该模型", retryable: false },
  "model_overloaded":             { message: "模型负载过高", suggestion: "当前模型请求量过大，请稍后重试或切换模型", retryable: true },
  "context_length_exceeded":      { message: "上下文超过模型限制", suggestion: "请缩短会话、清空对话或开启 Compaction", retryable: false },
  "rate_limit_exceeded":          { message: "请求频率超限", suggestion: "请稍后重试，或联系提供商提升 RPM/TPM 配额", retryable: true },
  "invalid_api_key":              { message: "API Key 无效", suggestion: "请检查 Key 是否正确，是否已过期或被吊销", retryable: false },
  "api_key_expired":              { message: "API Key 已过期", suggestion: "请联系提供商续期或生成新的 API Key", retryable: false },
  "content_filtered":             { message: "内容被安全过滤", suggestion: "输入或输出触发了 API 的内容安全策略，请调整措辞", retryable: false },
};
```

`sdk:error` 事件 payload 扩展 `suggestion?: string` 字段。

**⚠️ IPC 同步检查清单：**
- `src/ipc/payloadSchemas.ts` — `sdk:error` Zod schema 扩展 `suggestion: z.string().optional()`
- `npm test -- src/ipc/payloadSchemas.test.ts electron/agent/errorDiagnostics.test.ts`
- `npm run build`

---

#### L2. 调试日志完善

**目标：** 暴露 SDK 的 `debug` 和 `debugFile` 选项，让用户可开启调试日志。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentConfig.ts` | 修改 — `sanitizeUserSdkOptions` 增加 `debug`/`debugFile` 透传 |
| `electron/agent/sdkSettings.ts` | 修改 — `SettingsFormValues` 新增字段 |
| `src/app/components/SettingsPanel.tsx` | 修改 — 新增调试配置 |
| `src/ipc/payloadSchemas.ts` | 修改 — `settings:save` schema 扩展 |

**UI 规格：**

- 位于"高级设置"折叠区域底部
- 调试开关：`role="switch"`，标签"调试模式"，副标题"记录 SDK 原始消息用于排查问题"
- 日志路径输入：仅当调试开启时显示，默认 `.claude/debug.log`
- 面板底部新增两个按钮：
  - "导出调试日志" — 触发 IPC 调用，主进程读取日志文件通过 dialog 保存
  - "复制最近日志" — 复制最近 200 条 `rawMessages` 到剪贴板
- 按钮样式：12px `var(--text-secondary)`，`border-radius: var(--radius-sm)`，hover `var(--bg-sidebar-hover)`

**⚠️ IPC 同步检查清单：**
- `src/ipc/payloadSchemas.ts` — `settings:save` Zod schema 扩展 `debug: z.boolean().optional()` + `debugFile: z.string().optional()`
- `src/app/backendBridge.ts` — `SettingsFormValues` 类型扩展
- `electron/main.ts` — `settings:save` handler 透传
- `npm test -- src/ipc/payloadSchemas.test.ts`
- `npm run build`

---

#### L3. 错误重试策略

**目标：** 在 `AgentSessionManager.drainMessages()` 中增加网络瞬时错误的自动重试。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentSessionManager.ts` | 修改 — `drainMessages()` 增加重试包装 |

**重试策略：**

```typescript
const RETRYABLE_ERRORS = new Set([
  "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED",
  "socket hang up", "network error",
]);

async function drainWithRetry(
  runId: string,
  messages: AsyncIterable<unknown>,
  maxRetries = 3,
  attempt = 1
): Promise<void> {
  try {
    for await (const message of messages) {
      // 处理消息...
    }
  } catch (error) {
    const shouldRetry = attempt <= maxRetries && isRetryable(error);
    if (shouldRetry) {
      // 通知前端
      emit(runId, { type: "sdk:system-event", subtype: "retry_attempt", raw: { attempt, maxRetries } });
      // 线性退避
      await delay(1000 * attempt);
      return drainWithRetry(runId, messages, maxRetries, attempt + 1);
    }
    throw error;
  }
}
```

重试状态通过 `sdk:system-event` (subtype: `"retry_attempt"`) 通知前端，UI 显示"网络波动，正在重试 (2/3)..."。

**⚠️ IPC 同步检查清单：**
- `src/ipc/payloadSchemas.ts` — `sdk:system-event` subtype 枚举扩展 `"retry_attempt"`
- `npm test -- src/ipc/payloadSchemas.test.ts electron/agent/agentSessionManager.test.ts`
- `npm run build`

**Playwright E2E 验收：**

文件：`tests/e2e/error-handling.spec.ts`

```typescript
test("shows Chinese error message for invalid API key", async ({ page }) => {
  await page.goto("/");
  // 配置无效 API Key
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByPlaceholder("sk-ant-api-...").fill("invalid-key");
  // 发送消息触发错误
  await page.getByLabel("消息输入").fill("测试");
  await page.getByRole("button", { name: "发送" }).click();
  // 断言中文错误消息
  await expect(page.getByText("API Key 无效")).toBeVisible();
  await expect(page.getByText("请检查 Key 是否正确")).toBeVisible();
});

test("shows debug export button when debug mode enabled", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByText("高级设置").click();
  await page.getByRole("switch", { name: "调试模式" }).click();
  // 断言导出按钮可见
  await expect(page.getByRole("button", { name: "导出调试日志" })).toBeVisible();
});
```

---

## 七、阶段四：用户界面层（3 tasks）

### K. 设置面板功能补齐

#### K1. 新增配置项暴露

**目标：** 在 `SettingsPanel.tsx` 中汇总前三个阶段引入的全部配置项。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `src/app/components/SettingsPanel.tsx` | 修改 — 完整配置面板改造 |

**设置面板完整布局：**

```
┌──────────────────────────────────┐
│ 连接状态    ● 已连接              │  ← B4
│ [测试连接]                        │
│ ──────────────────────────────── │
│ Base URL                         │
│ [https://api.xxxxx.com         ] │
│ API Key                          │
│ [sk-xxxx••••••••••             ] │
│ 模型                             │
│ [claude-sonnet-4-6             ] │
│ ──────────────────────────────── │
│ 权限模式                          │  ← 已有
│ [default ▾                     ] │
│ 思考强度                          │  ← 已有
│ [medium ▾                      ] │
│ Thinking 展示                     │  ← 已有
│ [summarized ▾                  ] │
│ 推理努力程度                      │  ← 已有
│ [高 ▾                          ] │
│ ──────────────────────────────── │
│ ▼ 高级设置（折叠展开）            │  ← 新增折叠区域
│                                   │
│   结构化输出            [开/关]    │  ← D3
│   输出模板        [测试计划 ▾  ]   │
│   [自定义 Schema 文本区域...    ]  │
│                                   │
│   Prompt 缓存           [开/关]    │  ← F1
│   缓存命中率               —      │  ← F2 (运行时)
│                                   │
│   最大对话轮数           [  50 ]   │
│   成本上限 (USD)         [ 5.00]   │
│                                   │
│   调试模式              [开/关]    │  ← L2
│   日志文件路径      [./.claude/..] │
│ ──────────────────────────────── │
│ 主题    [浅色 | 暗色]             │  ← 已有
│ ──────────────────────────────── │
│ 沙箱保护 [开 | 关]                │  ← 已有
│ ──────────────────────────────── │
│ [导出调试日志] [复制最近日志]     │  ← L2
└──────────────────────────────────┘
```

**UI 设计约束（遵循 Claude Desktop 设计 token）：**

- 面板宽度：260px（保持现有）
- 高级设置折叠：
  - 折叠标题 "高级设置"：12px `var(--text-tertiary)`，字符 `▸`（折叠）/ `▾`（展开）
  - 折叠动画：`var(--transition-fast)` (150ms)，`max-height` 过渡
- 开关组件：复用主题/沙箱的按钮组模式 — 两个 `<button>`，选中 `class="active"`
- 新配置项标签：12px `var(--text-secondary)`，与现有标签风格一致
- 输入框：复用现有样式（`border-radius: var(--radius-sm)`，focus `border-color: var(--accent)`，`var(--font-mono)`）
- 灰显态：`opacity: 0.4; pointer-events: none; cursor: not-allowed`，`title` 属性提供 tooltip
- 分隔线：`border-top: 1px solid var(--border-subtle)`，上下 `8px` 间距
- 连接状态指示器：使用 `ActivityIndicator` 组件（`src/app/components/ActivityIndicator.tsx`）

---

#### K2. `UserSdkOptions` 类型补全

**目标：** 在 `electron/agent/agentConfig.ts` 中补全 `UserSdkOptions` 的缺失字段并实现校验。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/agentConfig.ts` | 修改 — 类型声明 + `sanitizeUserSdkOptions` 校验 |

**新增字段：**

| 字段 | 类型 | 校验规则 | 当前状态 |
|------|------|----------|----------|
| `outputFormat` | `object` | 结构校验（type/json_schema/schema） | 未声明 |
| `promptCaching` | `boolean` | 类型守卫 | 已声明无赋值 |
| `max_budget_usd` | `number` | 正数，最多 2 位小数 | 未声明 |
| `enableFileCheckpointing` | `boolean` | 类型守卫 | 未声明 |
| `debug` | `boolean` | 类型守卫 | 已声明无赋值 |
| `debugFile` | `string` | 合法路径字符串 | 已声明无赋值 |
| `fallback_model` | `string` | 非空字符串 | 未声明 |

---

#### K3. 配置持久化增强

**目标：** 扩展配置持久化的范围，新增应用级配置文件和模型能力缓存文件。

**涉及文件：**

| 文件 | 操作 |
|------|------|
| `electron/agent/sdkSettings.ts` | 修改 — 新增 `loadAppSettings`/`saveAppSettings` |
| `electron/main.ts` | 修改 — `settings:save` handler 扩展 |

**持久化策略：**

| 配置项 | 存储文件 | 键名 |
|--------|---------|------|
| baseUrl | `.claude/settings.json` / `.claude/settings.local.json` | `env.ANTHROPIC_BASE_URL` (已有) |
| apiKey | `.claude/settings.json` / `.claude/settings.local.json` | `env.ANTHROPIC_AUTH_TOKEN` (已有) |
| model | `.claude/settings.json` / `.claude/settings.local.json` | `env.ANTHROPIC_MODEL` (已有) |
| effort | `.claude/settings.json` / `.claude/settings.local.json` | `env.CLAUDE_CODE_EFFORT` (已有) |
| sandboxEnabled | `.claude/settings.json` / `.claude/settings.local.json` | `env.CLAUDE_CODE_SANDBOX_ENABLED` (已有) |
| promptCaching | `.claude/settings.json` / `.claude/settings.local.json` | `env.CLAUDE_CODE_PROMPT_CACHING` |
| debug | `.claude/settings.json` / `.claude/settings.local.json` | `env.CLAUDE_CODE_DEBUG` |
| debugFile | `.claude/settings.json` / `.claude/settings.local.json` | `env.CLAUDE_CODE_DEBUG_FILE` |
| maxBudgetUsd | `.claude/settings.json` / `.claude/settings.local.json` | `env.CLAUDE_CODE_MAX_BUDGET_USD` |
| outputFormat.template | `.claude/app-settings.json` | `outputFormat.template` |
| outputFormat.customSchema | `.claude/app-settings.json` | `outputFormat.customSchema` |
| 模型能力缓存 | `.claude/model-capabilities.json` | 独立文件（C2） |

**`.claude/app-settings.json` 格式：**

```json
{
  "version": 1,
  "outputFormat": {
    "template": "test_plan",
    "customSchema": null
  },
  "lastConnectionCheck": 1717200000000
}
```

**⚠️ IPC 同步检查清单（K 模块 — 设置面板全部配置项）：**
- `src/ipc/channels.ts` — 无新增通道
- `src/ipc/payloadSchemas.ts` — `settings:save` Zod schema 扩展全部新增字段
- `src/app/backendBridge.ts` — `SettingsFormValues` 类型 + `saveSettings` 参数同步
- `electron/main.ts` — `settings:save` handler 透传
- `electron/agent/sdkSettings.ts` — `SettingsFormValues` 类型 + `saveClaudeCodeSettings` 持久化
- `electron/preload.ts` — 无需变更
- `electron/preloadApi.ts` — 无需变更
- `npm test -- src/ipc/payloadSchemas.test.ts src/app/backendBridge.test.ts electron/agent/sdkSettings.test.ts src/app/components/SettingsPanel.test.tsx`
- `npm run build`

**Playwright E2E 验收：**

文件：`tests/e2e/settings-panel.spec.ts`

```typescript
test("persists advanced settings across panel reopen", async ({ page }) => {
  await page.goto("/");
  // 打开设置
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByText("高级设置").click();

  // 开启 promptCaching
  await page.getByRole("switch", { name: "Prompt 缓存" }).click();
  // 选择结构化输出模板
  await page.getByRole("switch", { name: "结构化输出" }).click();
  await page.getByRole("combobox", { name: "输出模板" }).selectOption("缺陷报告");

  // 关闭面板
  await page.keyboard.press("Escape");

  // 重新打开
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByText("高级设置").click();

  // 断言状态保持
  await expect(page.getByRole("switch", { name: "Prompt 缓存" })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "输出模板" })).toHaveValue("缺陷报告");
});

test("disables unsupported features with tooltip", async ({ page }) => {
  // 前提：使用不支持 caching 的模型
  await page.getByRole("switch", { name: "Prompt 缓存" }).hover();
  await expect(page.getByText("当前模型不支持 Prompt Caching")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Prompt 缓存" })).toBeDisabled();
});
```

---

## 八、全局时序图

### 完整对话启动流程

```
用户点击发送
      │
      ▼
backendBridge.createRun(prompt)
      │ IPC: run:create
      ▼
main.ts handler
      │
      ▼
AgentSessionManager.startRun(runId, prompt)
      │
      ├─→ connectionProbe.probeConnection(warmQuery)
      │     │ 状态 → IPC: sdk:connection-status → UI 指示器
      │     └─→ 返回 ConnectionStatus
      │
      ├─→ modelCapabilities.detect(model)
      │     │ → 检查缓存
      │     │ → 无缓存或过期 → 试探请求
      │     │ → 返回 ModelCapabilities
      │     └─→ 能力不足 → sdk:system-event (capability_degraded)
      │
      ├─→ loadAgentRuntimeConfig()
      │     │
      │     ├─→ buildSystemPrompt()
      │     │     └─→ SYSTEM_PROMPT_DYNAMIC_BOUNDARY 划分静态/动态段
      │     │
      │     ├─→ 根据 ModelCapabilities 降级
      │     │     ├─→ 删除不支持的 options
      │     │     └─→ 降级通知 → sdk:system-event
      │     │
      │     └─→ 合并 customTools + appMcpServer
      │
      ├─→ adapter.start({ prompt, options, canUseTool })
      │     │
      │     └─→ SDK query() → Claude Code 子进程 → 第三方 API
      │
      └─→ drainMessages(runId, session.messages)
            │
            ├─→ runEventMapper.map(message)
            │     ├─→ stream_event → assistant:* / tool:* / sdk:*
            │     ├─→ system → sdk:system-event / sdk:mcp-status / ...
            │     └─→ result → sdk:usage / sdk:error / run:status-changed
            │
            ├─→ errorDiagnostics.diagnose(error)
            │     └─→ 中文化错误消息 + 排查建议
            │
            ├─→ retry logic (L3)
            │     └─→ 网络瞬时错误重试
            │
            └─→ emit(runEvent) → IPC → sdkEventStore → UI
```

---

## 九、风险与回滚方案

### 风险矩阵

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 第三方 API 不支持能力探测 → 探测超时导致启动延迟 | 用户体验 | 中 | 探测超时设 5s 上限；超时后使用 heuristic 降级；并行探测 |
| `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 使用不当 → 缓存命中率反而下降 | Token 消耗 | 低 | 静态段严格不变；E2E 测试验证缓存命中率 |
| `outputFormat` 降级后的自然语言格式要求不够精确 → Agent 不按格式输出 | 输出质量 | 中 | 降级方案中保留 schema 约束的自然语言表达；前端解析非结构化 JSON |
| 自定义工具注册后 Agent 误用 | Agent 行为 | 低 | 工具 description 清晰描述使用时机；通过 `disallowedTools` 控制 |
| 进程重试导致重复消息 | 用户体验 | 中 | `drainMessages` 基于 message uuid 去重 |
| `outputFormat` / `promptCaching` 等新配置未同步 IPC → 设置不生效 | 功能缺陷 | 中 | 每个新增配置项遵循 IPC 同步检查清单；CI 中运行 channels/payloadSchemas 测试 |

### 回滚方案

- **连接验证 (B)**：`connectionProbe` 独立模块，探测失败不阻塞启动。回滚：移除 `startup().then()` 中的探测调用
- **能力检测 (C)**：缓存优先，探测失败使用 heuristic。回滚：删除 `modelCapabilities.ts` 和缓存文件
- **结构化输出 (D)**：通过已有 `run:apply-settings` 通道透传。回滚：移除 `SettingsPanel` 中的 UI 区块 + `agentConfig` 中的 `outputFormat` 字段
- **进程管理 (I)**：`spawnClaudeCodeProcess` 不传时 SDK 使用默认子进程管理。回滚：移除 `codeOptions` 中的 `spawnClaudeCodeProcess` 注入
- **所有变更均为增量添加，不修改已有核心逻辑的接口契约**

---

## 十、测试策略

### 单元测试

| 模块 | 测试文件 | 覆盖范围 |
|------|----------|----------|
| B. 连接验证 | `electron/agent/connectionProbe.test.ts` | 4 种连接状态 + 超时降级 |
| B. 错误诊断 | `electron/agent/errorDiagnostics.test.ts` | 所有错误码映射 + 未知错误降级 |
| C. 能力检测 | `electron/agent/modelCapabilities.test.ts` | 16 种能力组合 + 缓存读写 + TTL |
| D. 输出模板 | `src/domain/outputSchemas.test.ts` | 模板有效性 + schema 可通过 Zod 校验 |
| G. System Prompt | `electron/agent/systemPromptBuilder.test.ts` | 标记位置 + 静态/动态段分离 |
| H. 自定义工具 | `electron/agent/customTools.test.ts` | 工具定义完整性 |
| I. 进程管理 | `electron/agent/processManager.test.ts` | 重启退避 + 超限停止 + 优雅关闭 |
| L. 错误诊断 | `electron/agent/errorDiagnostics.test.ts` | 第三方错误码 + retryable 标记 |

### IPC 协议测试

| 测试文件 | 覆盖范围 |
|----------|----------|
| `src/ipc/channels.test.ts` | 新增通道在 allowlist 中 |
| `src/ipc/payloadSchemas.test.ts` | 新增 schema 的合法/非法输入 |
| `electron/preload.test.ts` | preload 白名单与 channels 同步 |

### 前端状态测试

| 测试文件 | 覆盖范围 |
|----------|----------|
| `src/app/sdkEventStore.test.ts` | `sdk:connection-status` / `sdk:system-event(capability_degraded)` / `sdk:system-event(process_health)` / `sdk:system-event(retry_attempt)` reducer |
| `src/app/components/SettingsPanel.test.tsx` | 配置项渲染 + 灰显逻辑 + 开关交互 |
| `src/app/components/ActivityIndicator.test.tsx` | 四种状态视觉 |
| `src/app/backendBridge.test.ts` | `saveSettings` 类型同步 |

### E2E 测试 (Playwright)

| 测试文件 | 场景数 | 覆盖阶段 |
|----------|--------|----------|
| `tests/e2e/connection-status.spec.ts` | 4 | B — 连接状态指示器 |
| `tests/e2e/model-capabilities.spec.ts` | 3 | C — 能力检测与灰显 |
| `tests/e2e/third-party-compat.spec.ts` | 2 | J — 第三方 API 兼容 |
| `tests/e2e/structured-output.spec.ts` | 3 | D — 结构化输出 |
| `tests/e2e/prompt-caching.spec.ts` | 2 | F — 缓存控制与命中率 |
| `tests/e2e/dynamic-system-prompt.spec.ts` | 2 | G — 动态提示边界 |
| `tests/e2e/custom-tools.spec.ts` | 2 | H — 自定义工具 |
| `tests/e2e/process-management.spec.ts` | 3 | I — 进程崩溃恢复 |
| `tests/e2e/error-handling.spec.ts` | 3 | L — 中文化错误+调试日志 |
| `tests/e2e/settings-panel.spec.ts` | 5 | K — 设置面板完整性 |

### 集成验证

```bash
# 阶段一完成后
npm test -- electron/agent/connectionProbe.test.ts electron/agent/errorDiagnostics.test.ts electron/agent/modelCapabilities.test.ts
npm test -- src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/preload.test.ts
npm run build

# 阶段二完成后
npm test -- src/domain/outputSchemas.test.ts electron/agent/systemPromptBuilder.test.ts electron/agent/customTools.test.ts
npm test -- src/app/sdkEventStore.test.ts src/app/components/SettingsPanel.test.tsx
npm run build
npx playwright test tests/e2e/structured-output.spec.ts tests/e2e/prompt-caching.spec.ts

# 阶段三完成后
npm test -- electron/agent/processManager.test.ts
npm run build
npx playwright test tests/e2e/process-management.spec.ts tests/e2e/error-handling.spec.ts

# 阶段四完成后
npm test
npm run build
npx playwright test tests/e2e/settings-panel.spec.ts

# 全量验证
npm test && npm run build && npx playwright test
```

---

## 十一、实施顺序与依赖矩阵

### 依赖关系图

```
B1 → B2 → B3 → B4
               (B4 依赖 C3-K)
C1 → C2 → C3 → C4
               (C4 在 AgentConfig 中调用)
J1 → J2, J3 (J1 独立，J2/J3 依赖 B1 连接探测)
D1 → D2 → D3 → D4
F1 → F2 (F2 UI 依赖 F1 开关)
G1 → G2
H1 → H2 → H3
I1 → I2 → I3
L1 → L2 → L3
K1 → K2 → K3 (汇总所有配置项)

跨阶段依赖：
  C4 → D4 (能力检测结果驱动降级)
  B1 → J3 (连接探测结果用于 initializationResult)
  C2 → F1 (能力缓存决定 caching 开关可用性)
  C2 → D3 (能力缓存决定 outputFormat 灰显)
  B4, C3, D3, F1, L2 → K1 (设置面板汇总所有配置项)
```

### 实施顺序

```
第一优先级（基础设施，无上游依赖）：
  B1 → B2 → B3
  C1 → C2
  J1

第二优先级（基础设施内部依赖）：
  B4（依赖 C3）
  C3 → C4
  J2 → J3（依赖 B1）
  L1

第三优先级（功能层，依赖基础设施）：
  D1 → D2
  F1
  G1 → G2
  H1 → H2

第四优先级（功能层内部依赖）：
  D3 → D4
  F2（依赖 F1 + 运行数据）
  H3（依赖 H2）

第五优先级（运维层，依赖功能层配置体系）：
  I1 → I2 → I3
  L2 → L3

第六优先级（UI 汇总层）：
  K2 → K1 → K3
```

---

## 十二、验收标准

### 全局验收

1. ✅ 所有 31 个任务均有对应的单元测试、IPC 测试或 E2E 测试覆盖
2. ✅ `npm test` 全部通过
3. ✅ `npm run build` 无类型错误
4. ✅ `npx playwright test` 全部通过
5. ✅ 未引入对 `api.anthropic.com` 的直接调用
6. ✅ 所有 IPC 变更已同步 channels.ts、payloadSchemas.ts、backendBridge.ts、main.ts、preload.ts、preloadApi.ts
7. ✅ Preload 白名单与共享 IPC 定义无漂移
8. ✅ 所有新增错误消息为中文
9. ✅ 所有 UI 变更遵循 Claude Desktop 设计 token（暖灰/石色、PingFang SC / Microsoft YaHei、低对比度、ActivityIndicator 组件复用）

### 阶段一验收

10. ✅ 启动后自动验证 API 连通性，连接状态指示器反映真实状态
11. ✅ 错误配置 baseUrl/apiKey → 中文错误消息 + 排查建议（非英文原文）
12. ✅ 模型能力首次检测后缓存，后续使用缓存值
13. ✅ 模型能力不支持的特性在设置面板灰显 + tooltip
14. ✅ 运行时自动降级：不支持 thinking/jsonSchema/caching → 移除对应 options + 降级通知
15. ✅ 第三方 API 的不同 usage 格式（total_tokens / prompt_tokens / 嵌套 usage）均被正确解析
16. ✅ `accountInfo()` 和 `initializationResult()` 返回第三方 API 信息

### 阶段二验收

17. ✅ 结构化输出可选择预设模板（测试计划/缺陷报告/证据摘要）或自定义
18. ✅ 模型不支持 JSON Schema 时，自动降级为 system prompt 中的自然语言格式要求
19. ✅ Prompt 缓存开关可配置，能力不支持时灰显
20. ✅ 缓存命中率实时显示在 UI 中
21. ✅ `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 正确划分 system prompt 的静态/动态段
22. ✅ 自定义工具 `generate_test_report`、`create_bug_draft`、`capture_evidence` 可被 Agent 调用
23. ✅ 应用内 MCP Server 注册到 SDK

### 阶段三验收

24. ✅ 子进程崩溃后自动重启（退避策略），超过最大次数后 UI 显示红色错误
25. ✅ 应用退出时所有子进程优雅关闭
26. ✅ 第三方特有错误码（余额不足、模型不存在、内容过滤等）有中文错误消息
27. ✅ 调试模式可开关，日志可导出
28. ✅ 网络瞬时错误自动重试，UI 显示重试进度

### 阶段四验收

29. ✅ 设置面板包含全部上述新增配置项
30. ✅ 配置持久化后关闭面板再打开，状态保持
31. ✅ 全部新增配置项的类型声明、序列化、IPC 透传链路闭合

---

## 自审结果

- 无占位符、TBD、TODO 或未完成标记
- 10 个模块 31 个任务覆盖完整，每个任务有明确的涉及文件、验收标准和测试要点
- 依赖关系清晰：阶段一→二→三→四，无循环依赖
- 全局 IPC 同步规则在每个涉及通道/配置变更的任务中显式列出
- UI 设计遵循 Claude Desktop 设计 token（浅色/暗色模式、字体系统、圆角系统、ActivityIndicator 组件）
- E2E 测试通过 Playwright 覆盖全部 10 个 Playwright 测试文件共 29 个场景
- 风险矩阵覆盖 6 个主要风险并给出缓解措施
- 回滚方案：所有变更为增量添加，关键模块可独立移除
- 与 `2026-05-31-claude-agent-sdk-adapter-audit-design.md` 互补无重叠
