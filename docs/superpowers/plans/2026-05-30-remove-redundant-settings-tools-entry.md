# 删除冗余设置入口和工具入口 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除聊天界面右上角齿轮设置入口、发送框内 model-pill 设置入口、发送框内工具入口，以及关联的 `SdkControlDrawer` 组件

**Architecture:** 纯删除任务——从 Composer、ConversationPane、App.tsx 中移除按钮和死代码，删除无入口的 SdkControlDrawer 组件。`SettingsPanel` 和所有后端代码保留不变。

**Tech Stack:** React 19 / TypeScript / Vitest

---

### Task 1: 删除 SdkControlDrawer 组件及测试

**Files:**
- Delete: `src/app/components/SdkControlDrawer.tsx`
- Delete: `src/app/components/SdkControlDrawer.test.tsx`

- [ ] **Step 1: 删除 SdkControlDrawer 源文件**

```bash
rm "D:/pythonProject/test ai agent/src/app/components/SdkControlDrawer.tsx"
```

- [ ] **Step 2: 删除 SdkControlDrawer 测试文件**

```bash
rm "D:/pythonProject/test ai agent/src/app/components/SdkControlDrawer.test.tsx"
```

- [ ] **Step 3: 提交**

```bash
git add src/app/components/SdkControlDrawer.tsx src/app/components/SdkControlDrawer.test.tsx
git commit -m "chore: 删除冗余 SdkControlDrawer 组件及测试"
```

---

### Task 2: 修改 ConversationPane 组件 — 删除右上角齿轮按钮和 modelName 传递

**Files:**
- Modify: `src/app/components/ConversationPane.tsx`

> **注意**：此 Task 放在 Composer 之前，确保先断开 `modelName` 传递链，避免中间状态类型错误。

- [ ] **Step 1: 修改 ConversationPane.tsx**

删除以下内容：
- `import { Settings } from "lucide-react";`（第 1 行）
- Props 中 `modelName?: string;`（第 15 行）
- Props 中 `onToggleSdkControl?: () => void;`（第 30 行）
- 解构中 `modelName = "Claude Sonnet 4",`（第 40 行）
- 解构中 `onToggleSdkControl,`（第 55 行）
- header 中的齿轮按钮（第 65-69 行）
- Composer JSX 中的 `modelName={modelName}` prop（第 109 行）

修改后的完整文件：

```tsx
import type { SdkUiState } from "../sdkUiTypes";
import { Composer } from "./Composer";
import { EmptyConversationState } from "./EmptyConversationState";
import { MessageStream } from "./MessageStream";
import { WindowControls } from "./WindowControls";

type Props = {
  state: SdkUiState;
  title: string;
  composerValue: string;
  hasTestExecution: boolean;
  activeRunId?: string;
  loadingHistorySession?: boolean;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
  onCopyMessage: (content: string) => void;
  onRetryMessage: (content: string) => void;
  onApprovePlan: () => void;
  onComposerChange: (value: string) => void;
  onComposerSubmit: (value: string) => void;
  onAddContent: () => void;
  onOpenTools: () => void;
  onOpenModelSettings: () => void;
  onMinimizeWindow: () => void;
  onToggleMaximizeWindow: () => void;
  onCloseWindow: () => void;
};

export function ConversationPane({
  state,
  title,
  composerValue,
  hasTestExecution,
  activeRunId,
  loadingHistorySession,
  onApprove,
  onDeny,
  onAnswer,
  onCopyMessage,
  onRetryMessage,
  onApprovePlan,
  onComposerChange,
  onComposerSubmit,
  onAddContent,
  onOpenTools,
  onOpenModelSettings,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
}: Props) {
  const isEmpty = state.messages.length === 0 && state.approvals.length === 0 && state.questions.length === 0 && state.errors.length === 0;
  const placeholder = hasTestExecution ? "补充测试指令或继续提问…" : "向 AI 测试助手提问…";

  return (
    <main className="conversation" aria-label="对话">
      <header className="conversation-header">
        <span className="conversation-title">{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <WindowControls
            onMinimize={onMinimizeWindow}
            onToggleMaximize={onToggleMaximizeWindow}
            onClose={onCloseWindow}
          />
        </div>
      </header>
      <section className="message-stream" aria-label="消息流">
        {loadingHistorySession ? (
          <div className="history-loading-banner" role="status" aria-live="polite" aria-label="正在加载历史会话">
            <span className="history-loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="history-loading-copy">正在加载历史会话…</span>
          </div>
        ) : isEmpty ? (
          <EmptyConversationState onSuggestionClick={onComposerChange} />
        ) : (
          <>
            <MessageStream
              state={state}
              onApprove={onApprove}
              onDeny={onDeny}
              onAnswer={onAnswer}
              onCopyMessage={onCopyMessage}
              onRetryMessage={onRetryMessage}
            />
            {activeRunId ? (
              <div className="plan-action-row">
                <button className="primary-action" type="button" onClick={onApprovePlan}>
                  确认计划并执行
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
      <Composer value={composerValue} onChange={onComposerChange} onSubmit={onComposerSubmit} onAddContent={onAddContent} onOpenTools={onOpenTools} onOpenModelSettings={onOpenModelSettings} placeholder={placeholder} />
    </main>
  );
}
```

- [ ] **Step 2: 同步删除 App.tsx 中 ConversationPane 的 `modelName` prop**

在 `src/app/App.tsx` 的 `return` JSX 中，删除传递给 `<ConversationPane>` 的 `modelName={selectedModel}`：

```tsx
// 删除这一行（约第 299 行）
modelName={selectedModel}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/components/ConversationPane.tsx src/app/App.tsx
git commit -m "chore: 删除 ConversationPane 右上角齿轮按钮和 modelName 传递链"
```

---

### Task 3: 修改 Composer 组件 — 删除工具按钮和 model-pill 按钮

**Files:**
- Modify: `src/app/components/Composer.tsx`

- [ ] **Step 1: 修改 Composer.tsx — 删除工具/设置按钮及 props**

删除 `onOpenTools`、`onOpenModelSettings`、`modelName` props，删除 `Wrench` 图标导入，删除 `composer-tools` 区域中的工具按钮和 model-pill 按钮：

```tsx
import { Plus, Send } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAddContent: () => void;
  placeholder: string;
};

export function Composer({
  value,
  onChange,
  onSubmit,
  onAddContent,
  placeholder,
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

  return (
    <form
      className="composer-shell"
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
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/components/Composer.tsx
git commit -m "chore: 删除 Composer 工具按钮和 model-pill 设置按钮"
```

---

### Task 4: 修改 Composer 测试文件 — 清理已删除功能的相关断言

**Files:**
- Modify: `src/app/components/Composer.test.tsx`

- [ ] **Step 1: 修改 Composer.test.tsx — 删除 onOpenTools/onOpenModelSettings 引用和工具按钮断言**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("ignores blank input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="" onChange={vi.fn()} onSubmit={onSubmit} onAddContent={vi.fn()} placeholder="向 AI 测试助手提问…" />);

    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders high-fidelity Chinese controls and submits trimmed text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="  测试订单模块  " onChange={vi.fn()} onSubmit={onSubmit} onAddContent={vi.fn()} placeholder="补充测试指令或继续提问…" />);

    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "补充测试指令或继续提问…");
    expect(screen.queryByPlaceholderText("回复 Claude…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加内容" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "工具" })).not.toBeInTheDocument();
    expect(screen.queryByText("Claude Sonnet 4")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith("测试订单模块");
  });
});
```

- [ ] **Step 2: 确认修改后的测试文件不再引用已删除的 props**

验证两处 `render(<Composer ... />)` 调用都已删除 `onOpenTools={vi.fn()}` 和 `onOpenModelSettings={vi.fn()}` props。

- [ ] **Step 3: 提交**

```bash
git add src/app/components/Composer.test.tsx
git commit -m "test: 更新 Composer 测试 — 删除工具按钮/model-pill 断言"
```

---

### Task 5: 修改 ConversationPane 测试文件 — 清理已删除功能的相关 mock props

**Files:**
- Modify: `src/app/components/ConversationPane.tsx`

- [ ] **Step 1: 修改 ConversationPane.tsx — 删除 Settings 导入、onToggleSdkControl prop、齿轮按钮**

```tsx
import type { SdkUiState } from "../sdkUiTypes";
import { Composer } from "./Composer";
import { EmptyConversationState } from "./EmptyConversationState";
import { MessageStream } from "./MessageStream";
import { WindowControls } from "./WindowControls";

type Props = {
  state: SdkUiState;
  title: string;
  composerValue: string;
  hasTestExecution: boolean;
  activeRunId?: string;
  loadingHistorySession?: boolean;
  modelName?: string;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
  onCopyMessage: (content: string) => void;
  onRetryMessage: (content: string) => void;
  onApprovePlan: () => void;
  onComposerChange: (value: string) => void;
  onComposerSubmit: (value: string) => void;
  onAddContent: () => void;
  onOpenTools: () => void;
  onOpenModelSettings: () => void;
  onMinimizeWindow: () => void;
  onToggleMaximizeWindow: () => void;
  onCloseWindow: () => void;
};

export function ConversationPane({
  state,
  title,
  composerValue,
  hasTestExecution,
  activeRunId,
  loadingHistorySession,
  modelName = "Claude Sonnet 4",
  onApprove,
  onDeny,
  onAnswer,
  onCopyMessage,
  onRetryMessage,
  onApprovePlan,
  onComposerChange,
  onComposerSubmit,
  onAddContent,
  onOpenTools,
  onOpenModelSettings,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
}: Props) {
  const isEmpty = state.messages.length === 0 && state.approvals.length === 0 && state.questions.length === 0 && state.errors.length === 0;
  const placeholder = hasTestExecution ? "补充测试指令或继续提问…" : "向 AI 测试助手提问…";

  return (
    <main className="conversation" aria-label="对话">
      <header className="conversation-header">
        <span className="conversation-title">{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <WindowControls
            onMinimize={onMinimizeWindow}
            onToggleMaximize={onToggleMaximizeWindow}
            onClose={onCloseWindow}
          />
        </div>
      </header>
      <section className="message-stream" aria-label="消息流">
        {loadingHistorySession ? (
          <div className="history-loading-banner" role="status" aria-live="polite" aria-label="正在加载历史会话">
            <span className="history-loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="history-loading-copy">正在加载历史会话…</span>
          </div>
        ) : isEmpty ? (
          <EmptyConversationState onSuggestionClick={onComposerChange} />
        ) : (
          <>
            <MessageStream
              state={state}
              onApprove={onApprove}
              onDeny={onDeny}
              onAnswer={onAnswer}
              onCopyMessage={onCopyMessage}
              onRetryMessage={onRetryMessage}
            />
            {activeRunId ? (
              <div className="plan-action-row">
                <button className="primary-action" type="button" onClick={onApprovePlan}>
                  确认计划并执行
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
      <Composer value={composerValue} onChange={onComposerChange} onSubmit={onComposerSubmit} onAddContent={onAddContent} onOpenTools={onOpenTools} onOpenModelSettings={onOpenModelSettings} placeholder={placeholder} modelName={modelName} />
    </main>
  );
}
```

删除的内容：
- `import { Settings } from "lucide-react";`（第 1 行）
- Props 中的 `onToggleSdkControl?: () => void;`（第 30 行）
- 解构中的 `onToggleSdkControl,`（第 55 行）
- header 中的齿轮按钮块（第 65-69 行）

- [ ] **Step 2: 提交**

```bash
git add src/app/components/ConversationPane.tsx
git commit -m "chore: 删除 ConversationPane 右上角齿轮设置按钮"
```

---

### Task 5: 修改 ConversationPane 测试文件 — 清理已删除功能的相关 mock props

**Files:**
- Modify: `src/app/components/ConversationPane.test.tsx`

- [ ] **Step 1: 修改 ConversationPane.test.tsx — 删除 `modelName` prop 传递和 onOpenTools/onOpenModelSettings mock props**

删除 callbacks 对象中的两行：
```tsx
// 删除这两行
onOpenTools: vi.fn(),
onOpenModelSettings: vi.fn(),
```

删除所有 `render(<ConversationPane ... />)` 调用中的三行 prop：
```tsx
// 删除这三行（出现在 3 个测试中，约第 42-43, 82-83, 113-114 行）
onOpenTools={callbacks.onOpenTools}
onOpenModelSettings={callbacks.onOpenModelSettings}
```

同时删除 render 中的 `modelName` prop（如果在 TT4 移除后有残留引用）。

**注意**：`callbacks` 对象是顶层常量，被所有测试共享。`onToggleSdkControl` 不存在于 callbacks 中（它在 ConversationPane 中是可选的 `?:`），无需处理。

- [ ] **Step 2: 提交**

```bash
git add src/app/components/ConversationPane.test.tsx
git commit -m "test: 更新 ConversationPane 测试 — 删除工具/设置相关 mock props"
```

---

### Task 6: 修改 App.tsx — 删除死代码

**Files:**
- Modify: `src/app/App.tsx`

- [ ] **Step 1: 删除 SdkControlDrawer 导入（第 6 行）**

```
删除: import { SdkControlDrawer } from "./components/SdkControlDrawer";
```

- [ ] **Step 2: 删除 controlOpen 状态（第 119 行）**

```
删除: const [controlOpen, setControlOpen] = useState(false);
```

- [ ] **Step 3: 删除 handleOpenTools 函数（第 269-273 行）**

```
删除:
  function handleOpenTools() {
    closeUtilityPanels();
    setControlOpen(false);
    setComposerNotice("工具面板即将开放");
  }
```

- [ ] **Step 4: 删除 handleOpenModelSettings 函数（第 275-279 行）**

```
删除:
  function handleOpenModelSettings() {
    closeUtilityPanels();
    setComposerNotice("");
    setControlOpen(true);
  }
```

- [ ] **Step 5: 删除 SdkControlDrawer 渲染（第 346 行）**

```
删除: {controlOpen ? <SdkControlDrawer bridge={bridge} onModelSaved={handleModelSaved} /> : null}
```

- [ ] **Step 6: 从 ConversationPane 渲染中删除 onOpenTools、onOpenModelSettings、onToggleSdkControl props**

在 `return` 中的 `<ConversationPane ... />` JSX 中：

```
删除: onOpenTools={handleOpenTools}
删除: onOpenModelSettings={handleOpenModelSettings}
删除: onToggleSdkControl={() => { closeUtilityPanels(); setComposerNotice(""); setControlOpen((v) => !v); }}
```

- [ ] **Step 7: 删除 setControlOpen 的所有剩余引用**

在以下函数中删除 `setControlOpen(false)` 调用：
- `handleNewChat` 函数（第 202 行附近）
- `handleSelectConversation` 函数（第 210 行附近）
- `handleResumeSession` 函数（第 224 行附近）
- `handleSelectProjects` 函数（第 259 行附近）

在以下函数中删除 `setControlOpen` 的调用：
- `handleAddContent` 函数（第 265 行附近）
- `handleOpenModelSettings`（整个函数删除）

在 `handleSelectProjects` 中删除 `setControlOpen(false)`。

**完整的删除清单**（按行号对应 App.tsx）：

| 行号 | 删除内容 |
|------|----------|
| 行号 | 删除内容 |
|------|----------|
| 6 | `import { SdkControlDrawer } from "./components/SdkControlDrawer";` |
| 119 | `const [controlOpen, setControlOpen] = useState(false);` |
| 202 | `setControlOpen(false);` (handleNewChat 内) |
| 210 | `setControlOpen(false);` (handleSelectConversation 内) |
| 224 | `setControlOpen(false);` (handleResumeSession 内) |
| 259 | `setControlOpen(false);` (handleSelectProjects 内) |
| 265 | `setControlOpen(false);` (handleAddContent 内) |
| 169-170 | `handleModelSaved` 函数体 |
| 269-273 | `handleOpenTools` 函数体 |
| 275-279 | `handleOpenModelSettings` 函数体 |
| 309  | `onOpenTools={handleOpenTools}` |
| 310  | `onOpenModelSettings={handleOpenModelSettings}` |
| 314-317 | `onToggleSdkControl={() => { closeUtilityPanels(); setComposerNotice(""); setControlOpen((v) => !v); }}` |
| 346  | `{controlOpen ? <SdkControlDrawer bridge={bridge} onModelSaved={handleModelSaved} /> : null}` |

- [ ] **Step 8: 提交**

```bash
git add src/app/App.tsx
git commit -m "chore: 删除 App.tsx 中 SdkControlDrawer/工具/设置入口死代码"
```

---

### Task 7: 运行完整测试套件确认零回归

- [ ] **Step 1: 运行全部单元测试**

```bash
cd "D:/pythonProject/test ai agent" && npx vitest run --exclude "tests/e2e/**" --reporter=verbose
```

**期望输出**: 所有测试通过，无失败。

- [ ] **Step 2: TypeScript 类型检查（build 命令包含 tsc）**

```bash
cd "D:/pythonProject/test ai agent" && npm run build
```

**期望输出**: 类型检查和构建均成功。

---

### Task 8: 最终提交（如有未提交的清理）

- [ ] **Step 1: 检查 git 状态**

```bash
cd "D:/pythonProject/test ai agent" && git status
```

确认所有文件已提交。

- [ ] **Step 2: 最终验证 — 再次运行测试**

```bash
cd "D:/pythonProject/test ai agent" && npx vitest run --exclude "tests/e2e/**"
```

**期望输出**: 全部通过。
