# Composer Token 信息栏实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Composer 底部添加信息行，显示 LLM 名称和当前会话 token 统计（输入/输出/缓存命中/上下文用量）

**Architecture:** 在 `SdkUiState` 中新增 `modelName` 字段并窄化 `usage` 类型为 `TokenUsage`。`Composer` 组件新增 `modelName` 和 `usage` props，在 `<form>` 下方渲染 info bar。`ConversationPane` 从 state 中提取数据透传给 `Composer`。不新增独立文件——`formatTokens` 作为 Composer 文件内的私有工具函数。

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library

---

### Task 1: 定义 TokenUsage 类型并更新 SdkUiState

**Files:**
- Modify: `src/app/sdkUiTypes.ts`

- [ ] **Step 1: 添加 TokenUsage 类型并更新 SdkUiState**

在 `sdkUiTypes.ts` 文件头部（`SdkUiState` 定义之前）添加 `TokenUsage` 类型，然后将 `SdkUiState` 中的 `usage` 从 `unknown` 改为 `TokenUsage`，并新增 `modelName` 字段。

```typescript
// 在 SdkUiState 定义之前添加
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

// SdkUiState 修改两处：
export type SdkUiState = {
  activeRunId?: string;
  modelName?: string;            // 新增
  messages: SdkMessage[];
  approvals: ApprovalRequest[];
  questions: QuestionRequest[];
  mcpServers: McpServerUiStatus[];
  evidence?: Evidence[];
  rawMessages: unknown[];
  usage?: TokenUsage;             // 从 unknown 改为 TokenUsage | undefined
  errors: Array<{ message: string; retryable: boolean }>;
  tasks: SdkTaskProgress[];
  sessions: SessionSummary[];
  workspaceModes: Record<string, SessionWorkspaceMode>;
  bugDraft?: BugDraft;
};
```

- [ ] **Step 2: 修复 sdkEventStore.ts 中的类型兼容**

由于 `SdkUiState.usage` 类型从 `unknown` 改为 `TokenUsage | undefined`，`sdkEventStore.ts` 第 132 行的赋值会产生类型错误。需要将 `payload.raw` 转换为 `TokenUsage`：

在 `src/app/sdkEventStore.ts` 顶部添加 import：

```typescript
import type { TokenUsage } from "./sdkUiTypes";
```

修改第 132 行：

```typescript
// 修改前：
if (event.channel === "sdk:usage") {
  return { ...state, activeRunId, usage: payload.raw };
}

// 修改后：
if (event.channel === "sdk:usage") {
  return { ...state, activeRunId, usage: payload.raw as TokenUsage };
}
```

- [ ] **Step 3: 验证类型检查通过**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

预期：无新增类型错误（可能有既存的，确认不包含 `TokenUsage` 或 `modelName` 相关的错误）。

- [ ] **Step 4: 提交**

```bash
git add src/app/sdkUiTypes.ts src/app/sdkEventStore.ts
git commit -m "feat: 添加 TokenUsage 类型并扩展 SdkUiState 支持 modelName"
```

---

### Task 2: 编写 formatTokens 工具函数测试

**Files:**
- Modify: `src/app/components/Composer.test.tsx`

- [ ] **Step 1: 在 Composer.test.tsx 中添加 formatTokens 相关测试**

注意：`formatTokens` 是 Composer 文件内的私有函数，不能直接导入测试。通过渲染 Composer 并传入不同 usage 值来间接测试格式化结果。

在现有的 `describe("Composer", () => {` 块末尾（最后一个 `it` 之后、`});` 之前）添加以下测试：

```typescript
  describe("token info bar", () => {
    it("displays model name when provided", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
        />,
      );

      expect(screen.getByText("Claude Opus 4.8")).toBeInTheDocument();
    });

    it("does not render info bar when modelName and usage are both undefined", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
        />,
      );

      expect(screen.queryByText("context")).not.toBeInTheDocument();
      expect(document.querySelector(".composer-info-bar")).not.toBeInTheDocument();
    });

    it("renders complete token info with formatted values", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 2458,
            outputTokens: 847,
            cacheReadInputTokens: 1230,
            contextTokens: 2100,
            maxContextTokens: 25000,
          }}
        />,
      );

      // k 单位格式化
      expect(screen.getByText("2.4k")).toBeInTheDocument();  // 2458 → 2.4k
      expect(screen.getByText("0.8k")).toBeInTheDocument();  // 847 → 0.8k
      expect(screen.getByText("1.2k")).toBeInTheDocument();  // 1230 → 1.2k (缓存命中)

      // context 标签存在
      expect(screen.getByText("context")).toBeInTheDocument();
    });

    it("does not render cache hit tokens when cache hit is zero", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 500,
            outputTokens: 300,
            cacheReadInputTokens: 0,
          }}
        />,
      );

      // 不应该出现缓存命中特有的颜色/样式元素
      expect(screen.queryByText("0k")).not.toBeInTheDocument();
    });

    it("does not render cache hit when cache-related fields are undefined", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 500,
            outputTokens: 300,
          }}
        />,
      );

      // 有输入输出，缓存未定义，不应出现缓存相关文本
      expect(screen.getByText("0.5k")).toBeInTheDocument();
      expect(screen.getByText("0.3k")).toBeInTheDocument();
      // 确认没有第三个 k 值（缓存的）
      const kValues = screen.getAllByText(/k$/);
      expect(kValues).toHaveLength(2); // 只有输入和输出
    });

    it("displays context usage without progress bar when maxContextTokens is undefined", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 500,
            outputTokens: 300,
            contextTokens: 1200,
          }}
        />,
      );

      expect(screen.getByText("context")).toBeInTheDocument();
      expect(screen.getByText("1.2k")).toBeInTheDocument();
      // 进度条不应存在
      expect(document.querySelector(".composer-context-bar")).not.toBeInTheDocument();
    });

    it("formats token values at boundaries correctly", () => {
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 999,
            outputTokens: 1000,
            cacheReadInputTokens: 1500,
          }}
        />,
      );

      // 999 < 1000 → 显示 "999"
      expect(screen.getByText("999")).toBeInTheDocument();
      // 1000 → 1.0k
      expect(screen.getByText("1.0k")).toBeInTheDocument();
      // 1500 → 1.5k
      expect(screen.getByText("1.5k")).toBeInTheDocument();
    });

    it("renders context tooltip content on hover", async () => {
      const user = userEvent.setup();
      render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onAddContent={vi.fn()}
          placeholder="向 AI 测试助手提问…"
          modelName="Claude Opus 4.8"
          usage={{
            inputTokens: 500,
            outputTokens: 300,
            contextTokens: 2100,
            maxContextTokens: 25000,
          }}
        />,
      );

      const contextZone = screen.getByText("context").closest("[class*='context']")!;
      await user.hover(contextZone);

      // tooltip 出现
      expect(screen.getByText("当前会话 tokens 总量")).toBeInTheDocument();
      expect(screen.getByText(/2,100/)).toBeInTheDocument();
      expect(screen.getByText(/25,000/)).toBeInTheDocument();
      expect(screen.getByText(/LLM 单会话最大容量：25k tokens/)).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: 运行测试确认全部失败**

```bash
npx vitest run src/app/components/Composer.test.tsx
```

预期：新增的 8 个测试全部 FAIL（因为 Composer 尚未实现 info bar 渲染）。

- [ ] **Step 3: 提交**

```bash
git add src/app/components/Composer.test.tsx
git commit -m "test: 添加 Composer token 信息栏测试用例（RED）"
```

---

### Task 3: 实现 Composer info bar 渲染逻辑

**Files:**
- Modify: `src/app/components/Composer.tsx`

- [ ] **Step 1: 重写 Composer 组件**

将 `Composer` 组件改为返回 wrapper div，内含 `<form>` 和 info bar。以下是完整的修改后代码：

```typescript
import { Plus, Send } from "lucide-react";
import type { TokenUsage } from "../sdkUiTypes";

function formatTokens(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + "k";
  }
  return String(n);
}

function getCacheTokens(usage: TokenUsage): number {
  return (usage.cacheCreationInputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0);
}

function hasTokenStats(usage?: TokenUsage): boolean {
  if (!usage) return false;
  return (
    usage.inputTokens !== undefined ||
    usage.outputTokens !== undefined ||
    usage.contextTokens !== undefined
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAddContent: () => void;
  placeholder: string;
  modelName?: string;
  usage?: TokenUsage;
};

export function Composer({
  value,
  onChange,
  onSubmit,
  onAddContent,
  placeholder,
  modelName,
  usage,
}: Props) {
  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  const showInfoBar = modelName !== undefined || hasTokenStats(usage);
  const cacheTokens = usage ? getCacheTokens(usage) : 0;
  const showCache = cacheTokens > 0;
  const contextPct =
    usage?.contextTokens !== undefined && usage?.maxContextTokens !== undefined && usage.maxContextTokens > 0
      ? Math.min(usage.contextTokens / usage.maxContextTokens, 1)
      : undefined;

  return (
    <div className="composer-wrapper">
      <form
        className={showInfoBar ? "composer-shell has-info-bar" : "composer-shell"}
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <textarea
          aria-label="消息输入"
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          value={value}
        />
        <div className="composer-toolbar">
          <div className="composer-tools">
            <button className="icon-button" type="button" aria-label="添加内容" title="添加内容" onClick={onAddContent}>
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>
          <button className="composer-send" type="submit" aria-label="发送">
            <Send aria-hidden="true" size={16} />
          </button>
        </div>
      </form>
      {showInfoBar ? (
        <div className="composer-info-bar">
          <span className="composer-info-model">{modelName ?? ""}</span>
          {hasTokenStats(usage) ? (
            <div className="composer-info-tokens">
              {usage!.inputTokens !== undefined ? (
                <span className="composer-token-item">
                  <span aria-hidden="true">↘</span>{" "}
                  <strong>{formatTokens(usage!.inputTokens)}</strong>
                </span>
              ) : null}
              {usage!.outputTokens !== undefined ? (
                <span className="composer-token-item">
                  <span aria-hidden="true">↗</span>{" "}
                  <strong>{formatTokens(usage!.outputTokens)}</strong>
                </span>
              ) : null}
              {showCache ? (
                <span className="composer-token-item cache-hit">
                  <span aria-hidden="true">⚡</span>{" "}
                  <strong>{formatTokens(cacheTokens)}</strong>
                </span>
              ) : null}
              {usage!.contextTokens !== undefined ? (
                <span className="composer-token-item context-zone">
                  <span>context</span>{" "}
                  <strong>{formatTokens(usage!.contextTokens)}</strong>
                  {contextPct !== undefined ? (
                    <span className="composer-context-bar" aria-hidden="true">
                      <span
                        className="composer-context-fill"
                        style={{ width: `${(contextPct * 100).toFixed(0)}%` }}
                      />
                    </span>
                  ) : null}
                  <span className="composer-context-tooltip">
                    <div className="tooltip-heading">当前会话 tokens 总量</div>
                    <div>
                      已用{" "}
                      {usage!.contextTokens!.toLocaleString()}
                      {" / "}
                      {usage!.maxContextTokens?.toLocaleString() ?? "--"}{" "}
                      tokens
                    </div>
                    {contextPct !== undefined ? (
                      <div className="tooltip-progress">
                        <span
                          className="tooltip-progress-fill"
                          style={{ width: `${(contextPct * 100).toFixed(0)}%` }}
                        />
                      </div>
                    ) : null}
                    {usage!.maxContextTokens !== undefined ? (
                      <div className="tooltip-capacity">
                        LLM 单会话最大容量：{(usage!.maxContextTokens / 1000).toFixed(0)}k tokens
                      </div>
                    ) : null}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: 运行测试**

```bash
npx vitest run src/app/components/Composer.test.tsx
```

预期：新增的 info bar 测试 PASS，原有的 Composer 测试保持 PASS（可能需要微调）。

- [ ] **Step 3: 提交**

```bash
git add src/app/components/Composer.tsx
git commit -m "feat: Composer 底部添加 token 信息栏"
```

---

### Task 4: 添加 info bar CSS 样式

**Files:**
- Modify: `src/ui/styles.css`

- [ ] **Step 1: 修改 .composer-shell 样式，添加 info bar 和相关样式**

在 `styles.css` 中找到 `.composer-shell` 选择器，进行以下修改和新增：

**修改 `.composer-shell`**（原样式基础上调整 border-radius，新增 `.has-info-bar` 变体）：

```css
.composer-shell {
  margin: 0 auto 18px;
  width: min(var(--composer-max-width), calc(100% - 92px));
  min-height: 86px;
  padding: 14px 14px 12px;
  background: var(--bg-composer);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  display: grid;
  grid-template-rows: 1fr auto;
  flex: none;
}

/* 当有 info bar 时，form 区域底部去掉圆角 */
.composer-shell.has-info-bar {
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  border-bottom: 0;
  box-shadow: var(--shadow-lg);
  margin-bottom: 0;
}

.composer-shell:focus-within {
  border-color: var(--accent);
  box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent);
}
```

**新增 `.composer-wrapper`**（包裹 form 和 info bar）：

```css
/* Composer 外层包裹器 — 当有 info bar 时统一控制 margin 和宽度 */
.composer-wrapper {
  flex: none;
}

.composer-wrapper .composer-shell {
  margin: 0 auto 18px;
}

.composer-wrapper .composer-shell.has-info-bar {
  margin-bottom: 0;
}
```

**新增 `.composer-info-bar`**：

```css
/* ============================================================
   COMPOSER INFO BAR — 底部信息行
   ============================================================ */
.composer-info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 auto 18px;
  width: min(var(--composer-max-width), calc(100% - 92px));
  padding: 5px 16px;
  border: 1px solid var(--border-subtle);
  border-top: 1px solid var(--border-strong);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  background: var(--bg-composer);
  box-shadow: var(--shadow-lg);
  font-size: var(--font-xs);
  color: var(--text-secondary);
}
```

**新增 token 项和信息样式**：

```css
.composer-info-model {
  font-size: var(--font-xs);
  font-weight: 520;
  color: var(--text-primary);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-info-tokens {
  display: flex;
  align-items: center;
  gap: 12px;
}

.composer-token-item {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.composer-token-item strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-weight: 520;
}

.composer-token-item.cache-hit {
  color: var(--green);
}

.composer-token-item.cache-hit strong {
  color: var(--green);
}

.composer-token-item.context-zone {
  position: relative;
  cursor: help;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 5px;
  border-radius: 3px;
  transition: background var(--transition-fast);
}

.composer-token-item.context-zone:hover {
  background: var(--border-subtle);
}
```

**新增进度条样式**：

```css
.composer-context-bar {
  display: inline-block;
  width: 28px;
  height: 2px;
  background: var(--border-strong);
  border-radius: 1px;
  vertical-align: middle;
}

.composer-context-fill {
  display: block;
  height: 100%;
  background: var(--green);
  border-radius: 1px;
}
```

**新增 tooltip 样式**：

```css
/* ============================================================
   CONTEXT TOOLTIP — 上下文用量悬浮提示
   ============================================================ */
.composer-context-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 12px);
  right: 0;
  background: #1e1d1a;
  color: #d4d1c8;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.6;
  white-space: nowrap;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  z-index: 10;
  pointer-events: none;
}

.composer-context-tooltip .tooltip-heading {
  margin-bottom: 4px;
  color: #faf9f5;
  font-weight: 520;
}

.composer-context-tooltip .tooltip-progress {
  margin-top: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.composer-context-tooltip .tooltip-progress-fill {
  display: block;
  height: 100%;
  background: var(--green);
  border-radius: 2px;
}

.composer-context-tooltip .tooltip-capacity {
  margin-top: 4px;
  font-size: 10px;
  color: #6b6960;
}

/* 小三角箭头 */
.composer-context-tooltip::after {
  content: "";
  position: absolute;
  bottom: -6px;
  right: 16px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #1e1d1a;
}

.composer-token-item.context-zone:hover .composer-context-tooltip {
  display: block;
}

/* Dark 主题 tooltip */
:root.dark .composer-context-tooltip {
  background: #faf9f5;
  color: #141413;
}

:root.dark .composer-context-tooltip .tooltip-heading {
  color: #141413;
}

:root.dark .composer-context-tooltip .tooltip-progress {
  background: #ece3d7;
}

:root.dark .composer-context-tooltip .tooltip-capacity {
  color: #6b6960;
}

:root.dark .composer-context-tooltip::after {
  border-top-color: #faf9f5;
}
```

**修改 test-mode 下的 composer 宽度**（在 `.test-mode .composer-shell` 之后追加）：

```css
.test-mode .composer-wrapper .composer-shell,
.test-mode .composer-info-bar {
  width: min(610px, calc(100% - 52px));
}
```

- [ ] **Step 2: 运行测试确认样式生效**

```bash
npx vitest run src/app/components/Composer.test.tsx
```

预期：全部 PASS（CSS 不影响组件测试通过性，但需确认 DOM 结构一致）。

- [ ] **Step 3: 提交**

```bash
git add src/ui/styles.css
git commit -m "style: 添加 composer info bar 和 context tooltip 样式"
```

---

### Task 5: 在 ConversationPane 中透传 modelName 和 usage

**Files:**
- Modify: `src/app/components/ConversationPane.tsx`

- [ ] **Step 1: 从 state 提取数据并传递给 Composer**

在 `ConversationPane` 中找到 `<Composer ... />` 调用，添加 `modelName` 和 `usage` props：

```typescript
// 在 return 中的 <Composer> 调用处，添加两个 props：
<Composer
  value={composerValue}
  onChange={onComposerChange}
  onSubmit={onComposerSubmit}
  onAddContent={onAddContent}
  placeholder={placeholder}
  modelName={state.modelName}
  usage={state.usage as import("../sdkUiTypes").TokenUsage | undefined}
/>
```

注意：由于 `state.usage` 类型为 `TokenUsage | undefined`（已在 Task 1 中窄化），直接传递即可。导入 `TokenUsage` 类型用于 cast（或直接在 Composer import 中解决）。

实际更简洁的做法：在 ConversationPane 顶部添加 import：

```typescript
import type { TokenUsage } from "../sdkUiTypes";
```

然后直接传递：
```typescript
modelName={state.modelName}
usage={state.usage}
```

- [ ] **Step 2: 运行 ConversationPane 测试确认不破坏现有行为**

```bash
npx vitest run src/app/components/ConversationPane.test.tsx
```

预期：现有测试 PASS（因为 `createInitialSdkUiState()` 不包含 `modelName` 和 `usage`，Composer 会正确处理 undefined）。

- [ ] **Step 3: 运行 Composer 测试确认全部通过**

```bash
npx vitest run src/app/components/Composer.test.tsx
```

预期：全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/app/components/ConversationPane.tsx
git commit -m "feat: ConversationPane 透传 modelName 和 usage 给 Composer"
```

---

### Task 6: 更新 ConversationPane 测试

**Files:**
- Modify: `src/app/components/ConversationPane.test.tsx`

- [ ] **Step 1: 添加 state 包含 modelName 和 usage 时的测试**

在 `ConversationPane` 测试文件末尾（`});` 之前）添加：

```typescript
  it("passes modelName and usage from state to Composer info bar", () => {
    const state = createInitialSdkUiState();
    state.modelName = "Claude Opus 4.8";
    state.usage = {
      inputTokens: 1132,
      outputTokens: 423,
      cacheReadInputTokens: 580,
      contextTokens: 2100,
      maxContextTokens: 25000,
    };

    render(
      <ConversationPane
        state={state}
        title="token 测试"
        composerValue=""
        hasTestExecution={false}
        activeRunId="run-1"
        onApprove={callbacks.onApprove}
        onDeny={callbacks.onDeny}
        onAnswer={callbacks.onAnswer}
        onCopyMessage={callbacks.onCopyMessage}
        onRetryMessage={callbacks.onRetryMessage}
        onApprovePlan={callbacks.onApprovePlan}
        onComposerChange={callbacks.onComposerChange}
        onComposerSubmit={callbacks.onComposerSubmit}
        onAddContent={callbacks.onAddContent}
        onMinimizeWindow={callbacks.onMinimizeWindow}
        onToggleMaximizeWindow={callbacks.onToggleMaximizeWindow}
        onCloseWindow={callbacks.onCloseWindow}
      />,
    );

    // 验证模型名显示在 Composer 中
    expect(screen.getByText("Claude Opus 4.8")).toBeInTheDocument();
    // 验证 token 统计显示
    expect(screen.getByText("1.1k")).toBeInTheDocument();  // 1132 → 1.1k
    expect(screen.getByText("context")).toBeInTheDocument();
    expect(screen.getByText("2.1k")).toBeInTheDocument();  // 2100 → 2.1k
  });

  it("does not display token info bar when state has no usage or modelName", () => {
    const state = createInitialSdkUiState();

    render(
      <ConversationPane
        state={state}
        title="无 token"
        composerValue=""
        hasTestExecution={false}
        activeRunId={undefined}
        onApprove={callbacks.onApprove}
        onDeny={callbacks.onDeny}
        onAnswer={callbacks.onAnswer}
        onCopyMessage={callbacks.onCopyMessage}
        onRetryMessage={callbacks.onRetryMessage}
        onApprovePlan={callbacks.onApprovePlan}
        onComposerChange={callbacks.onComposerChange}
        onComposerSubmit={callbacks.onComposerSubmit}
        onAddContent={callbacks.onAddContent}
        onMinimizeWindow={callbacks.onMinimizeWindow}
        onToggleMaximizeWindow={callbacks.onToggleMaximizeWindow}
        onCloseWindow={callbacks.onCloseWindow}
      />,
    );

    // info bar 不应渲染
    expect(document.querySelector(".composer-info-bar")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行测试**

```bash
npx vitest run src/app/components/ConversationPane.test.tsx
```

预期：新增 2 个测试 PASS。

- [ ] **Step 3: 提交**

```bash
git add src/app/components/ConversationPane.test.tsx
git commit -m "test: 添加 ConversationPane 透传 token 信息给 Composer 的测试"
```

---

### Task 7: 运行全量测试并验证

**Files:**
- (无新增或修改，仅验证)

- [ ] **Step 1: 运行完整测试套件**

```bash
npx vitest run
```

预期：全部测试 PASS，无回归。

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit --project tsconfig.json && npx tsc --noEmit --project tsconfig.node.json
```

预期：无新增类型错误。

- [ ] **Step 3: 启动开发服务器手动验证**

```bash
npm run dev
```

打开浏览器 http://127.0.0.1:5173，确认：
- Composer 底部默认不显示 info bar（因为 `modelName` 和 `usage` 都是 undefined）
- （可选）在 App.tsx 的 fallback 或 SDK 模拟中设置 `modelName` 和 `usage` 值，验证 info bar 显示

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: 全量测试通过，Token 信息栏功能完成"
```

---

### 文件变更汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/app/sdkUiTypes.ts` | 修改 | 新增 `TokenUsage` 类型，`SdkUiState` 新增 `modelName`，`usage` 类型窄化 |
| `src/app/sdkEventStore.ts` | 修改 | `sdk:usage` 事件处理中将 `payload.raw` 显式转为 `TokenUsage` |
| `src/app/components/Composer.tsx` | 修改 | 新增 info bar 渲染、私有格式化函数、两个新 props |
| `src/app/components/Composer.test.tsx` | 修改 | 新增 8 个 info bar 测试 + formatTokens 边界测试 |
| `src/app/components/ConversationPane.tsx` | 修改 | 透传 `modelName` 和 `usage` 给 Composer |
| `src/app/components/ConversationPane.test.tsx` | 修改 | 新增 2 个透传验证测试 |
| `src/ui/styles.css` | 修改 | 新增 `.composer-wrapper`、`.composer-info-bar`、tooltip 等样式 |

**未变更**：`App.tsx`、`sdkEventStore.ts`、`ipc/channels.ts` 等（无需改动）。
