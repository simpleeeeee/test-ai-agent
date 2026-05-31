# Spec 1: SDK Options 补全与配置层改造

> **状态**: 设计已确认，待实现
> **日期**: 2026-05-31
> **前提**: 本项目仅使用中国大陆第三方 LLM API，不使用 Anthropic 官方 API

## 一、概述

将 Claude Agent SDK（`@anthropic-ai/claude-agent-sdk` v0.3.150）的 27 个未暴露配置项补全到 `agentConfig.ts`，补全 2 个权限模式，集成 3 个 SDK alpha 函数，并在设置面板新增 2 个高频配置项（推理努力程度、沙箱保护）。

## 二、影响文件

| 文件 | 改动类型 |
|------|---------|
| `electron/agent/agentConfig.ts` | 核心改动：类型扩展、校验函数扩展、设置加载逻辑改造 |
| `electron/agent/sdkSettings.ts` | 新增函数 + 类型扩展 |
| `electron/agent/claudeAgentSdkFacade.ts` | 新增 re-export |
| `src/app/components/SettingsPanel.tsx` | UI 新增 2 个配置项 |
| `src/app/backendBridge.ts` | 扩展 `SettingsFormValues` 类型 |
| `src/app/App.tsx` | 透传新字段 |
| `electron/agent/agentConfig.test.ts` | 新增测试用例 |

## 三、配置层架构改造

### 3.1 架构图

```
                    ┌─────────────────────────────┐
                    │     sdkSettings.ts           │
                    │  loadClaudeCodeSettings()    │ ← 保留，UI 向后兼容
                    │  saveClaudeCodeSettings()    │ ← 扩展，新增 effort/sandbox
                    │  loadResolvedSettings()  ★   │ ← 新增，调用 resolveSettings()
                    │  filterEscalatingMode()  ★   │ ← 新增，包装 SDK 同名函数
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │     agentConfig.ts           │
                    │  UserSdkOptions（~43 字段）★ │ ← 从 16 → 43 个字段
                    │  sanitizeUserSdkOptions() ★  │ ← 新增 27 个字段的校验
                    │  loadAgentRuntimeConfig() ★  │ ← option 合并改用 resolveSettings
                    └───────────────────────────────┘
```

### 3.2 `sdkSettings.ts` 变更

#### 3.2.1 扩展 `SettingsFormValues`

```typescript
export type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
  // 新增
  effort?: string;          // low | medium | high | xhigh | max
  sandboxEnabled?: boolean; // 沙箱是否启用
};
```

#### 3.2.2 新增 `loadResolvedSettings()`

```typescript
import { resolveSettings, filterEscalatingDefaultMode } from "./claudeAgentSdkFacade.js";

async function loadResolvedSettings(cwd: string): Promise<{
  effective: Settings;
  provenance: Record<string, { source: string; path?: string }>;
}>
```

调用 SDK 的 `resolveSettings({ cwd })` 获取完整合并设置，然后过 `filterEscalatingDefaultMode`。

失败时回退到 `loadClaudeCodeSettings(cwd)` + 空 `provenance`。

#### 3.2.3 新增 `filterEscalatingMode()`

```typescript
function filterEscalatingMode(resolved: ResolvedSettings): Settings
```

纯同步包装 `filterEscalatingDefaultMode`，提供友好函数名和本地错误处理。

### 3.3 `agentConfig.ts` 变更

#### 3.3.1 `loadAgentRuntimeConfig()` 改用双路径

```
核心路径: loadResolvedSettings(cwd) → 获取 SDK 合并后的完整 Settings
兼容路径: loadClaudeCodeSettings(cwd) → 保留用于读取 baseUrl/apiKey/model

合并优先级（与 SDK CLI 行为一致）:
  flag settings（运行时 applyFlagSettings）   ← 最高
  local settings（.claude/settings.local.json）
  project settings（.claude/settings.json）
  user settings（~/.claude/settings.json）
  managed settings（managedSettings option）   ← 最低
```

#### 3.3.2 `UserSdkOptions` 类型扩展

从现有的 ~16 个字段扩展到 ~43 个字段。完整字段列表见第四章。

## 四、新增 Options 清单（27 个）

### A 组：白名单 Set 校验（5 个）

| 字段 | 允许值 | 默认值 |
|------|--------|--------|
| `effort` | `low` `medium` `high` `xhigh` `max` | `high` |
| `executable` | `bun` `deno` `node` | 不设（自动检测） |
| `sessionStoreFlush` | `batched` `eager` | `batched` |
| `betas` | `['context-1m-2025-08-07']`（数组元素逐个校验） | 不设 |
| `settingSources` | `['user', 'project', 'local']`（数组元素逐个校验） | 不设（全部加载） |

### B 组：类型守卫校验（12 个）

| 字段 | 类型 | 校验规则 |
|------|------|---------|
| `title` | `string` | `typeof === 'string'` |
| `debug` | `boolean` | `typeof === 'boolean'` |
| `debugFile` | `string` | `typeof === 'string'` |
| `strictMcpConfig` | `boolean` | `typeof === 'boolean'` |
| `persistSession` | `boolean` | `typeof === 'boolean'` |
| `includeHookEvents` | `boolean` | `typeof === 'boolean'` |
| `forwardSubagentText` | `boolean` | `typeof === 'boolean'` |
| `promptSuggestions` | `boolean` | `typeof === 'boolean'` |
| `agentProgressSummaries` | `boolean` | `typeof === 'boolean'` |
| `allowDangerouslySkipPermissions` | `boolean` | `typeof === 'boolean'` |
| `planModeInstructions` | `string` | `typeof === 'string'` |
| `permissionPromptToolName` | `string` | `typeof === 'string'` |

### C 组：结构校验 / 部分透传（10 个）

| 字段 | 类型 | 校验方式 |
|------|------|---------|
| `toolConfig` | `{ askUserQuestion?: { previewFormat?: 'markdown' \| 'html' } }` | 逐字段结构校验 |
| `sandbox` | `SandboxSettings` | 关键子字段校验（`enabled`、`network`），其余透传 |
| `plugins` | `SdkPluginConfig[]` | 数组元素含 `type: 'local'` + `path: string` 则放行 |
| `managedSettings` | `Settings` | 对象即透传 |
| `settings` | `string \| Settings` | 字符串或对象 |
| `toolAliases` | `Record<string, string>` | 键值均为 string |
| `agent` | `string` | `typeof === 'string'` |
| `extraArgs` | `Record<string, string \| null>` | 键值校验 |
| `executableArgs` | `string[]` | `Array.isArray` + 元素为 string |
| `resumeSessionAt` | `string` | `typeof === 'string'` |

### D 组：回调/实例类型（4 个，不在 UserSdkOptions 中）

这 4 个字段是回调函数或运行时实例，无法序列化到 JSON 设置文件，因此不放入 `UserSdkOptions`。改为在 `loadAgentRuntimeConfig()` 中新增 `codeOptions` 参数（独立于 `userSdkOptions`），由调用方 `AgentSessionManager.startRun()` 在运行时注入：

```typescript
// agentConfig.ts
export function loadAgentRuntimeConfig(input: {
  cwd: string;
  claudeConfigDir?: string | null;
  userSdkOptions?: unknown;
  codeOptions?: {           // 新增：回调/实例参数
    onElicitation?: OnElicitation;
    spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
    stderr?: (data: string) => void;
    abortController?: AbortController;
  };
}): AgentRuntimeConfig
```

| 字段 | 类型 | 注入位置 |
|------|------|---------|
| `onElicitation` | `(request, options) => Promise<ElicitationResult>` | `AgentSessionManager` → `codeOptions` |
| `spawnClaudeCodeProcess` | `(options: SpawnOptions) => SpawnedProcess` | 同上 |
| `stderr` | `(data: string) => void` | 同上 |
| `abortController` | `AbortController` | 同上 |

## 五、权限模式补全

### 5.1 变更内容

`agentConfig.ts` 中 `permissionModes` 从 4 个扩展到 6 个：

```typescript
// 之前
const permissionModes = new Set(["default", "acceptEdits", "bypassPermissions", "plan"]);

// 之后
const permissionModes = new Set([
  "default", "acceptEdits", "bypassPermissions", "plan",
  "dontAsk", "auto",
]);
```

### 5.2 新增模式说明

| 模式 | 含义 |
|------|------|
| `dontAsk` | 不弹窗询问用户，未预批准的工具调用直接拒绝 |
| `auto` | 使用模型分类器自动判断是否批准工具调用 |

### 5.3 安全约束

`auto` 和 `bypassPermissions` 同属提权模式。如果设置来源是 project tier（`.claude/settings.json`），`filterEscalatingDefaultMode()` 会将其降级为 `default`。此约束在 `agentConfig.ts` 的注释中说明。

## 六、UI 层新增配置项

### 6.1 设置面板新增项（2 项）

| 标签（中文） | 控件类型 | 选项/范围 | SDK 字段 | 持久化路径 |
|-------------|---------|----------|---------|-----------|
| 推理努力程度 | 下拉选择 | 低 / 中 / 高 / 极高 / 最大 | `effort` | `.claude/settings.local.json` |
| 沙箱保护 | 开关按钮 | 开 / 关 | `sandbox.enabled` | `.claude/settings.local.json` |

### 6.2 配置传递路径

```
SettingsPanel.tsx                  ← 用户操作
  ↓ handleSave()
bridge.saveSettings({ ... })       ← 扩展 SettingsFormValues
  ↓ api.invoke("settings:save")
sdkSettings.ts::saveClaudeCodeSettings()
  ↓ 写入 .claude/settings.local.json

下次 startRun 时:
agentConfig.ts::loadAgentRuntimeConfig()
  ↓ 读取 settings → 构建 sdkOptions（effort、sandbox）
  ↓
SDK query({ options: sdkOptions })
```

与新存的 `baseUrl`、`apiKey`、`model` 同路径处理。修改后需重新发起会话才能生效。

### 6.3 SettingsPanel.tsx 改动点

- `SettingsFormValues` 本地类型扩展（新增 `effort`、`sandboxEnabled`）
- 新增 `effort` 状态 + 下拉选择组件（参考现有的 "思考强度" select 模式）
- 新增 `sandboxEnabled` 状态 + 开关按钮组件（参考现有的 "主题" 切换按钮模式）
- `handleSave()` 中传入新字段
- 所有标签使用中文

## 七、三个 Alpha 函数集成

### 7.1 `resolveSettings` — 设置合并解析

**集成位置**: `agentConfig.ts` 中 `loadAgentRuntimeConfig()`

**调用方式**:
```typescript
const resolved = await resolveSettings({ cwd, settingSources });
// resolved.effective: 最终生效的完整 Settings 对象
// resolved.provenance: 每个字段的配置来源追溯
```

**失败处理**: 如果 SDK 子进程不可用或设置文件损坏导致 `resolveSettings` 失败，回退到 `loadClaudeCodeSettings(cwd)` 手动合并路径，并输出 warning 日志。

### 7.2 `filterEscalatingDefaultMode` — 越权过滤

**集成位置**: `agentConfig.ts`，紧跟在 `resolveSettings()` 之后

**调用方式**:
```typescript
const safe = filterEscalatingDefaultMode(resolved);
// 纯函数，无需 await
```

**逻辑**: 如果 `permissions.defaultMode` 被设置为提权模式（`bypassPermissions` / `auto` / `acceptEdits`）且来源是 `project` tier，则从 effective 中移除该值。

### 7.3 `foldSessionSummary` — 会话摘要计算

**集成位置**: `claudeAgentSdkFacade.ts`

**暴露方式**: 纯 re-export
```typescript
export { foldSessionSummary } from "@anthropic-ai/claude-agent-sdk";
```

零运行时开销。为未来的 SessionStore 实现提供基础设施。

## 八、错误处理

| 场景 | 处理方式 |
|------|---------|
| `resolveSettings()` 调用失败 | 回退到现有 `loadClaudeCodeSettings` 路径，输出 warning |
| 配置字段校验失败 | 不符合白名单/类型守卫的字段被静默丢弃，不抛异常（与现有行为一致） |
| `filterEscalatingDefaultMode` 输入异常 | 纯函数不抛异常，输入无效时返回原值 |
| 设置文件不存在 | `saveClaudeCodeSettings` 自动创建 `.claude/` 目录和文件（现有行为） |
| UI 保存设置失败 | 不阻塞 UI，静默失败（与现有 `handleSave` 行为一致） |

## 九、测试策略

### 9.1 单元测试（`agentConfig.test.ts`）

- `sanitizeUserSdkOptions` 对新增 27 个字段的校验：合法值通过、非法值被丢弃
- `permissionMode` 的新值 `dontAsk` / `auto` 通过校验
- `effort` 的白名单校验：`low`/`medium`/`high`/`xhigh`/`max` 通过，其他值丢弃
- `sandbox` 的结构校验：有效 `{ enabled: true }` 通过，非对象丢弃
- `resolveSettings` 回退路径：SDK 不可用时回退到 `loadClaudeCodeSettings`

### 9.2 组件测试（`SettingsPanel.test.tsx`）

- 新增下拉和开关控件渲染正确
- 选择"推理努力程度"后保存，`saveSettings` 被调用且参数正确
- 切换"沙箱保护"后保存，`saveSettings` 被调用且参数正确

### 9.3 集成测试（`agentSessionManager.test.ts`）

- `startRun` 时构造的 `sdkOptions` 包含新字段
- 权限模式 `dontAsk` / `auto` 正确传递到 SDK

## 十、不在范围内

- 不暴露 `sessionStore` / `sessionStoreFlush` / `loadTimeoutMs` / `taskBudget`（用户排除的 alpha options）
- 不实现 `fallbackModel` / `maxBudgetUsd` / `enableFileCheckpointing`（用户排除）
- 不做 `SettingsPanel` 的大改版（仅追加 2 个控件）
- 不做 `connectRemoteControl`（依赖 Anthropic 云端基础设施）
- 不做 IPC 通道变更（本 spec 不涉及运行时 API 暴露，那是 Spec 2 的范围）
