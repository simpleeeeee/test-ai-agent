# Composer Token 信息栏设计

**日期**：2026-05-31
**状态**：已确认
**目标**：在 Composer 底部显示 LLM 名称和当前会话的 token 统计信息

## 1. 背景

### 1.1 需求

用户在对话界面需要看到以下信息：

1. 当前使用的 LLM 名称
2. 当前会话的 token 统计：
   - 输入 tokens
   - 输出 tokens
   - 缓存命中 tokens
   - 上下文用量（已用 / 总容量）

### 1.2 Claude Desktop 原生参考

Claude Desktop 在 Composer 底部有一个信息行，但**仅显示模型选择器**（可点击切换模型），**不显示 token 统计**。本项目需要在同一位置扩展 token 统计展示。

## 2. 设计方案

### 2.1 最终方案（D-4 优化版）

**位置**：Composer 底部，与输入框视觉相连（上部分为输入区，下部分为信息行，合起来为一个视觉整体）。

**布局**：

```
┌──────────────────────────────────────────────────────────┐
│  [textarea]                                [+]  [↗ Send] │
├──────────────────────────────────────────────────────────┤
│  Claude Opus 4.8    ↘ 1.1k ↗ 0.4k ⚡ 0.6k context 2.1k ▬ │
└──────────────────────────────────────────────────────────┘
```

**左侧**：LLM 名称（纯文本，无状态指示点，无下拉箭头）
**右侧**：token 统计项（k 单位缩写）

### 2.2 信息项明细

| 项目 | 显示格式 | 颜色 | 说明 |
|------|---------|------|------|
| 输入 tokens | `↘ 1.1k` | 主文字色 | ≥1000 时除以 1000 保留 1 位小数 + k |
| 输出 tokens | `↗ 0.4k` | 主文字色 | 同上 |
| 缓存命中 | `⚡ 0.6k` | 绿色 (#788c5d) | 标识缓存命中，绿色与项目现有 green token 一致 |
| 上下文用量 | `context 2.1k ▬` | 主文字色 + 迷你进度条 | 纯文字标签 "context"，后跟缩写值和进度条 |

### 2.3 Hover 交互

鼠标悬停到 `context` 区域时，弹出 tooltip 显示精确信息：

```
┌─────────────────────────────────────┐
│ 当前会话 tokens 总量                  │
│ 已用 2,100 / 25,000 tokens          │
│ ▓░░░░░░░░░░░░░░░░░░░░░░ (8%)       │
│ LLM 单会话最大容量：25k tokens        │
└─────────────────────────────────────┘
```

Tooltip 采用深色背景（`#1e1d1a`），白色文字，带小三角指向 context 区域。

### 2.4 设计决策

| 决策项 | 结论 | 理由 |
|--------|------|------|
| 位置 | Composer 底部附加行 | 复刻 Claude Desktop，不干扰主内容区 |
| LLM 名称样式 | 纯文本 | 当前不提供模型切换功能，不暗示交互 |
| Token 格式 | k 单位缩写 | 节省空间，1.1k 比 1,132 更简洁 |
| 缓存命中颜色 | 绿色 `#788c5d` | 项目 CSS 变量 `--green`，表示"节省"的正面含义 |
| 上下文标签 | 纯文字 "context" | 零歧义，不依赖 icon 隐喻 |
| 上下文详情 | Hover tooltip | 常驻显示缩写值，需要精确值时悬停查看 |

## 3. 数据模型

### 3.1 Usage 数据结构

`SdkUiState` 中已有 `usage?: unknown` 字段。需要定义具体类型：

```typescript
// src/app/sdkUiTypes.ts

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  /** 当前会话已使用的上下文 tokens 总量 */
  contextTokens?: number;
  /** LLM 支持的单会话最大上下文 tokens */
  maxContextTokens?: number;
};
```

### 3.2 数据来源

`usage` 数据通过 `sdk:usage` IPC 事件从后端推送，已在 `reduceSdkUiEvent` 中处理：

```typescript
// sdkEventStore.ts (现有逻辑)
if (event.channel === "sdk:usage") {
  return { ...state, activeRunId, usage: payload.raw };
}
```

### 3.3 向后兼容

- 当 `usage` 为 `undefined` 或缺少某些字段时，对应项不显示或显示 `--`
- 缓存命中 token = `(cacheCreationInputTokens ?? 0) + (cacheReadInputTokens ?? 0)`
- 进度条百分比 = `contextTokens / maxContextTokens`，无 `maxContextTokens` 时不显示进度条

## 4. 组件架构

### 4.1 变更范围

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/app/sdkUiTypes.ts` | 新增 `TokenUsage` 类型 + `SdkUiState` 增加 `modelName` 和 `usage` 类型窄化 | 定义数据结构 |
| `src/app/components/Composer.tsx` | **新增 info bar 渲染** | 添加模型名 + token 信息行 |
| `src/app/components/Composer.test.tsx` | 新增测试用例 | 测试各显示状态 |
| `src/ui/styles.css` | 新增样式 | composer info bar + tooltip 相关 CSS |

**不变更**：`App.tsx`（透传不变）、`ConversationPane.tsx`（从 `state` 中取 `modelName` 和 `usage` 传给 Composer，无需新 props）、`sdkEventStore.ts`（现有 `sdk:usage` 处理逻辑足够，仅需在 `SdkUiState` 中将 `usage` 类型从 `unknown` 改为 `TokenUsage \| undefined`）。

### 4.2 SdkUiState 变更

```typescript
// src/app/sdkUiTypes.ts

export type SdkUiState = {
  activeRunId?: string;
  modelName?: string;            // 新增：当前使用的 LLM 名称
  messages: SdkMessage[];
  approvals: ApprovalRequest[];
  questions: QuestionRequest[];
  mcpServers: McpServerUiStatus[];
  evidence?: Evidence[];
  rawMessages: unknown[];
  usage?: TokenUsage;             // 窄化：从 unknown 改为 TokenUsage | undefined
  errors: Array<{ message: string; retryable: boolean }>;
  tasks: SdkTaskProgress[];
  sessions: SessionSummary[];
  workspaceModes: Record<string, SessionWorkspaceMode>;
  bugDraft?: BugDraft;
};
```

`modelName` 的数据来源：
- 后端通过 SDK 事件推送（如 `sdk:status` 事件中包含模型名信息），由 `reduceSdkUiEvent` 写入 state
- 或者作为初始状态的一部分从设置中读取（如 Agent SDK 初始化时指定的模型）
- v1 实现中，`modelName` 可以从 `createInitialSdkUiState` 中设置默认值，后续由后端事件更新

### 4.3 Composer Props 变更

### 4.2 Composer Props 变更

```typescript
type Props = {
  // 现有 props ...
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAddContent: () => void;
  placeholder: string;
  // 新增 props
  modelName?: string;
  usage?: TokenUsage;
};
```

### 4.4 Token 格式化工具函数

```typescript
// 放在 Composer.tsx 同文件或 src/app/formatTokens.ts
function formatTokens(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k.toFixed(1) + "k";
  }
  return String(n);
}
```

## 5. 样式设计

### 5.1 信息行 CSS

```css
.composer-info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 16px;
  border: 1px solid var(--border-subtle);
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  background: var(--bg-composer);
}
```

信息行样式需同时适配 light 和 dark 主题（使用 CSS 变量）。

### 5.2 Composer 结构调整

当前 `composer-shell` 是一个完整圆角容器。信息行需要与 textarea 共享同一个视觉边界：

- 输入区上部：`border-radius: 12px 12px 0 0`，底部 `border-bottom: 0`
- 信息行下部：`border-radius: 0 0 12px 12px`，顶部 `border-top` 浅色分隔
- 两个区域的 `border` + `box-shadow` 合并为一个视觉整体

这意味着 `Composer` 组件需要返回包裹元素而不是单个 `form`，或者将信息行作为 `form` 内部元素。

### 5.3 Tooltip 样式

```css
.composer-context-tooltip {
  position: absolute;
  bottom: calc(100% + 12px);
  right: 0;
  background: #1e1d1a;
  color: #d4d1c8;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 11px;
  white-space: nowrap;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  z-index: 10;
  pointer-events: none;
}
```

Dark 主题下 tooltip 背景改为 `#faf9f5`（浅色背景），文字改为深色。

## 6. 边界情况

| 场景 | 处理 |
|------|------|
| `usage` 为 `undefined` | 不显示 token 统计，仅显示模型名 |
| `usage` 中某字段为 `undefined` | 该项不渲染（不显示 `--`） |
| `maxContextTokens` 为 `undefined` | 不显示进度条，仅显示 `context 2.1k` |
| 缓存命中为 0 | 不显示缓存命中项（`0k` 无意义） |
| tokens 超过 1,000,000 | `formatTokens` 结果如 `1.0M` → 实际场景极少，暂不处理 |
| 窗口过窄（< 600px） | 信息行不换行，优先显示模型名和 context，其余省略 |
| Hover tooltip 超出视口 | 需要 JS 检测边界，可选处理，v1 不做 |
| 模型名过长 | `max-width` + `text-overflow: ellipsis` 截断 |

## 7. 测试策略

### 7.1 单元测试 (Vitest)

| 测试项 | 描述 |
|--------|------|
| 渲染模型名 | `modelName` prop 正确显示 |
| 渲染无模型名 | `modelName` 为 undefined 时左侧留空 |
| 渲染完整 token 信息 | 所有字段都有值时正确显示格式化后的值 |
| 渲染部分 token 信息 | 某些字段缺失时对应项不渲染 |
| 渲染无 usage | `usage` 为 undefined 时不渲染 token 统计区 |
| 缓存命中为 0 | 不渲染缓存命中项 |
| formatTokens 边界 | 999、1000、1500、0 等关键值格式化正确 |
| context tooltip hover | 模拟 hover 行为验证 tooltip 内容 |

### 7.2 组件测试 (Vitest + RTL)

- 验证 composer info bar 在 DOM 中的存在性
- 验证格式化后的 token 文本内容
- 验证 tooltip 的显示/隐藏行为

### 7.3 E2E 测试 (Playwright)

- 端到端：发送消息 → 检查底部信息行出现并显示 token 数据（如果后端模拟推送了 usage 事件）
- 可选：未来接入真实 Agent 后端后验证

## 8. 不在范围

- **模型切换下拉菜单**：当前只展示模型名，不提供切换功能
- **token 用量历史图表**：不在此需求范围内
- **上下文用量告警**：接近上限时的警告提示，v1 不做
- **设置面板中的 token 相关配置**：属于设置功能，不在本 spec 范围

## 9. 实现步骤概览

1. 定义 `TokenUsage` 类型 (`sdkUiTypes.ts`)
2. 编写 `formatTokens` 工具函数
3. 修改 `Composer` 组件：添加 info bar 渲染逻辑
4. 添加 CSS 样式（info bar + tooltip）
5. 编写单元测试和组件测试
6. 在 `ConversationPane` 中将 `modelName` 和 `usage` 传给 `Composer`
7. 验证 E2E
