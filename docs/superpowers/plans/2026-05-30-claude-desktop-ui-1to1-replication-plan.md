# Claude Desktop UI 1:1 像素级复刻 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端 UI 从"Claude 风格启发"升级为精确 Claude Desktop 像素级复刻，涵盖设计 token、暗色模式、新增组件、布局修复。

**Architecture:** CSS 变量驱动视觉层 → 修改 7 个现有组件 + 新增 4 个组件 → 更新组件测试和 E2E 测试匹配新 DOM/色值。按 TDD 流程：先写失败测试 → 最小实现 → 通过。

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Playwright, CSS custom properties, lucide-react

---

### Task 1: CSS Design Token 全面重写

**Files:**
- Modify: `src/ui/styles.css` (全量替换)

**目标:** 用精确 Claude Desktop 色值/字体/圆角/阴影/过渡替换现有变量，新增暗色模式和全局基础样式。

- [ ] **Step 1: 先运行现有测试确认基线**

```bash
npm test
```
预期: 全部通过（当前基准）

- [ ] **Step 2: 重写 `:root` 设计 token**

编辑 `src/ui/styles.css`，替换文件开头所有 CSS 变量：

```css
:root {
  /* Light mode */
  --bg-primary: #faf9f5;
  --bg-sidebar: #e8e6dc;
  --bg-sidebar-hover: #dbd1c0;
  --bg-sidebar-active: #d4c9b4;
  --bg-composer: #FFFFFF;
  --bg-card: #FFFFFF;
  --bg-bubble: #DDD9CE;
  --bg-pill: #eef1f6;

  --text-primary: #141413;
  --text-secondary: #6b6960;
  --text-tertiary: #b0aea5;

  --border-subtle: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.12);
  --border-pill: #dce2ec;

  --accent: #d97757;
  --accent-hover: #c56541;
  --accent-active: #ae5630;
  --accent-soft: rgba(217, 119, 87, 0.15);

  --green: #788c5d;
  --red: #c4554d;

  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
  --radius-2xl: 14px;
  --radius-3xl: 16px;
  --radius-full: 9999px;

  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06);
  --shadow-md: 0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.085);
  --shadow-xl: 0 16px 34px rgba(0,0,0,0.14);

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  --font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;

  --font-xs: 11px;
  --font-sm: 12px;
  --font-base: 13px;
  --font-md: 14px;
  --font-lg: 16px;
  --font-xl: 18px;
  --font-2xl: 20px;
  --font-3xl: 22px;

  --transition-fast: 150ms cubic-bezier(0.165, 0.85, 0.45, 1);
  --transition-base: 300ms cubic-bezier(0.165, 0.85, 0.45, 1);

  --sidebar-width: 260px;
  --header-height: 54px;
  --message-max-width: 650px;
  --composer-max-width: 670px;

  color-scheme: light;
}

/* Dark mode */
:root.dark {
  --bg-primary: #141413;
  --bg-sidebar: #1a1a19;
  --bg-sidebar-hover: #2b2a27;
  --bg-sidebar-active: #32312d;
  --bg-composer: #1f1e1b;
  --bg-card: #1f1e1b;
  --bg-bubble: #393937;
  --bg-pill: #2b2f38;

  --text-primary: #faf9f5;
  --text-secondary: #9a9893;
  --text-tertiary: #6b6960;

  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);
  --border-pill: rgba(255, 255, 255, 0.12);

  --accent-soft: rgba(217, 119, 87, 0.15);
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.2);
  --shadow-sm: 0 0 0 1px rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.2);
  --shadow-md: 0 0 0 1px rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.25);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.3);
  --shadow-xl: 0 16px 34px rgba(0,0,0,0.35);

  color-scheme: dark;
}
```

- [ ] **Step 3: 重写全局基础样式**

在同一文件中替换 reset/base 部分：

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  width: 100%; height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-width: 960px;
}

button, textarea, select, input {
  font: inherit;
  -webkit-app-region: no-drag;
}

button { cursor: pointer; }

button:focus-visible,
textarea:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: var(--radius-full); }
::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }
```

- [ ] **Step 4: 运行测试确认 token 变更不破坏现有功能**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/styles.css
git commit -m "refactor: 重写 CSS 设计 token 为 Claude Desktop 精确色值"
```

---

### Task 2: App Shell 布局 — 侧边栏 260px + 对话面板三行 Grid

**Files:**
- Modify: `src/ui/styles.css` (`.app-shell`, `.claude-sidebar`, `.conversation`)

- [ ] **Step 1: 更新 App Shell Grid**

```css
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.app-shell.chat-mode {
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
}

.app-shell.test-mode {
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr) 300px;
}
```

- [ ] **Step 2: 更新侧边栏为 4 行 Grid**

```css
.claude-sidebar {
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: grid;
  grid-template-rows: var(--header-height) auto minmax(0, 1fr) auto;
  height: 100%;
  overflow: hidden;
  min-width: 0;
  user-select: none;
}
```

- [ ] **Step 3: 更新对话面板为 3 行 Grid + Header 渐变**

```css
.conversation {
  background: var(--bg-primary);
  display: grid;
  grid-template-rows: var(--header-height) 1fr auto;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 12px 0 26px;
  -webkit-app-region: drag;
  position: relative;
  z-index: 2;
  background: var(--bg-primary);
}

.conversation-header::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: -8px;
  height: 8px;
  background: linear-gradient(to bottom, var(--bg-primary), transparent);
  pointer-events: none;
}
```

- [ ] **Step 4: 更新消息流为独立滚动**

```css
.message-stream {
  display: grid;
  align-content: start;
  gap: 16px;
  justify-items: center;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 0 16px;
  scroll-behavior: smooth;
  min-height: 0;
}
```

- [ ] **Step 5: 运行测试**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/styles.css
git commit -m "refactor: 更新 App Shell 布局 — 侧边栏 260px, 对话面板三行 Grid, Header 渐变"
```

---

### Task 3: ActivityIndicator 组件 (新增)

**Files:**
- Create: `src/app/components/ActivityIndicator.tsx`
- Create: `src/app/components/ActivityIndicator.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/app/components/ActivityIndicator.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityIndicator } from "./ActivityIndicator";

describe("ActivityIndicator", () => {
  it("renders with default active state", () => {
    const { container } = render(<ActivityIndicator />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveClass("activity-indicator");
    expect(dot).toHaveClass("active");
  });

  it("renders idle state", () => {
    const { container } = render(<ActivityIndicator status="idle" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveClass("idle");
    expect(dot).not.toHaveClass("active");
  });

  it("renders done state", () => {
    const { container } = render(<ActivityIndicator status="done" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveClass("done");
  });

  it("renders error state", () => {
    const { container } = render(<ActivityIndicator status="error" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveClass("error");
  });
});
```

运行: `npm test -- src/app/components/ActivityIndicator.test.tsx`
预期: FAIL — 组件不存在

- [ ] **Step 2: 实现 ActivityIndicator 组件**

创建 `src/app/components/ActivityIndicator.tsx`:

```tsx
type Props = {
  status?: "idle" | "active" | "done" | "error";
};

export function ActivityIndicator({ status = "active" }: Props) {
  return <span className={`activity-indicator ${status}`} aria-hidden="true" />;
}
```

- [ ] **Step 3: 添加 CSS**

在 `src/ui/styles.css` 中添加：

```css
.activity-indicator {
  --indicator-size: 8px;
  width: var(--indicator-size);
  height: var(--indicator-size);
  border-radius: var(--radius-full);
  background: var(--text-tertiary);
  flex: none;
  transition: background var(--transition-base), transform var(--transition-base);
}

.activity-indicator.idle {
  background: #c5c1b9;
  animation: none;
}

.activity-indicator.active {
  background: var(--accent);
  animation: indicator-pulse 1.2s ease-in-out infinite;
}

@keyframes indicator-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.35); opacity: 1; }
}

.activity-indicator.done {
  background: var(--green);
  animation: none;
}

.activity-indicator.error {
  background: var(--red);
  animation: none;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- src/app/components/ActivityIndicator.test.tsx
```
预期: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/ActivityIndicator.tsx src/app/components/ActivityIndicator.test.tsx src/ui/styles.css
git commit -m "feat: 新增 ActivityIndicator 通用活动状态指示器组件"
```

---

### Task 4: 更新 ClaudeSidebar — 移除 profile 区 + 添加设置按钮

**Files:**
- Modify: `src/app/components/ClaudeSidebar.tsx` (移除 profile, 添加 `onSettingsClick` prop, 添加 sidebar-footer)
- Modify: `src/app/components/ClaudeSidebar.test.tsx` (适配新 DOM)

- [ ] **Step 1: 先更新测试**

编辑 `src/app/components/ClaudeSidebar.test.tsx`，将 profile 引用替换为设置按钮引用。修改 "专业版" 断言为设置按钮：

```tsx
it("renders AI 测试助手 navigation and shows settings button", async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();
    const onSelectConversation = vi.fn();
    const onSelectProjects = vi.fn();
    const onResumeSession = vi.fn();
    const onSettingsClick = vi.fn();

    render(
      <ClaudeSidebar
        activeRunId="run-2"
        sessions={[
          { id: "run-1", title: "今天的咨询", tags: [] },
          { id: "run-2", title: "订单模块回归", tags: ["测试"] },
        ]}
        onNewChat={onNewChat}
        onSelectConversation={onSelectConversation}
        onSelectProjects={onSelectProjects}
        onResumeSession={onResumeSession}
        onSettingsClick={onSettingsClick}
      />,
    );

    expect(screen.getByText("AI 测试助手")).toBeInTheDocument();
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建聊天" })).toBeInTheDocument();
    expect(screen.getByText("最近")).toBeInTheDocument();
    expect(screen.getByText("订单模块回归")).toBeInTheDocument();
    // profile area removed
    expect(screen.queryByText("专业版")).not.toBeInTheDocument();
    expect(screen.queryByText("测试人员")).not.toBeInTheDocument();
    // settings button present
    expect(screen.getByText("设置")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建聊天" }));
    await user.click(screen.getByText("设置"));
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });
```

运行: `npm test -- src/app/components/ClaudeSidebar.test.tsx`
预期: FAIL — 测试人员/专业版 不存在，设置按钮不存在

- [ ] **Step 2: 更新 ClaudeSidebar 组件**

编辑 `src/app/components/ClaudeSidebar.tsx`:

```tsx
import { Folder, MessageSquare, Plus, Settings, Sparkles } from "lucide-react";
import type { SessionSummary } from "../sdkUiTypes";

type Props = {
  activeRunId?: string;
  sessions: SessionSummary[];
  onNewChat: () => void;
  onSelectConversation: () => void;
  onSelectProjects: () => void;
  onResumeSession: (sessionId: string) => void;
  onSettingsClick: () => void;
};

export function ClaudeSidebar({ activeRunId, sessions, onNewChat, onSelectConversation, onSelectProjects, onResumeSession, onSettingsClick }: Props) {
  return (
    <aside className="claude-sidebar" aria-label="会话导航">
      <div className="claude-brand">
        <Sparkles aria-hidden="true" className="claude-brand-icon" size={22} />
        <span>AI 测试助手</span>
      </div>
      <nav className="claude-nav" aria-label="主导航">
        <button className="claude-nav-item" type="button" onClick={onNewChat}>
          <Plus aria-hidden="true" size={18} />
          新建聊天
        </button>
        <button className="claude-nav-item active" type="button" onClick={onSelectConversation}>
          <MessageSquare aria-hidden="true" size={18} />
          对话
        </button>
        <button className="claude-nav-item" type="button" onClick={onSelectProjects}>
          <Folder aria-hidden="true" size={18} />
          项目
        </button>
      </nav>
      <div className="recent-section">
        <p className="recent-title">最近</p>
        {sessions.length === 0 ? <p className="recent-empty">暂无最近对话</p> : null}
        {sessions.map((session) => (
          <button
            className={session.id === activeRunId ? "recent-session active" : "recent-session"}
            key={session.id}
            type="button"
            onClick={() => onResumeSession(session.id)}
          >
            {session.title}
          </button>
        ))}
      </div>
      <div className="claude-sidebar-footer">
        <button type="button" onClick={onSettingsClick}>
          <Settings aria-hidden="true" size={16} />
          设置
        </button>
      </div>
    </aside>
  );
}
```

并添加 footer CSS：

```css
.claude-sidebar-footer {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-top: 1px solid var(--border-subtle);
}

.claude-sidebar-footer button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-base);
  font-weight: 450;
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.claude-sidebar-footer button:hover {
  background: var(--bg-sidebar-hover);
  color: var(--text-primary);
}
```

- [ ] **Step 3: 运行测试验证通过**

```bash
npm test -- src/app/components/ClaudeSidebar.test.tsx
```
预期: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/components/ClaudeSidebar.tsx src/app/components/ClaudeSidebar.test.tsx src/ui/styles.css
git commit -m "feat: 更新 ClaudeSidebar — 移除 profile 区, 添加底部设置按钮"
```

---

### Task 5: 更新 App.tsx — 传递 onSettingsClick + 管理设置面板状态 + 移除 profile 相关

**Files:**
- Modify: `src/app/App.tsx` (添加 settingsOpen 状态, 传递 onSettingsClick)

- [ ] **Step 1: 先运行现有测试确认基线**

```bash
npm test -- src/app/App.test.tsx
```

- [ ] **Step 2: 更新 App.tsx**

在 `App` 组件中添加:

```tsx
const [settingsOpen, setSettingsOpen] = useState(false);
```

更新 `ClaudeSidebar` 调用:

```tsx
<ClaudeSidebar
  activeRunId={state.activeRunId}
  sessions={state.sessions}
  onNewChat={handleNewChat}
  onSelectConversation={handleSelectConversation}
  onSelectProjects={handleSelectProjects}
  onResumeSession={handleResumeSession}
  onSettingsClick={() => setSettingsOpen((v) => !v)}
/>
```

（SettingsPanel 组件在后续 task 中实现，当前先留占位。）

- [ ] **Step 3: 运行全量测试**

```bash
npm test
```
预期: 除 App.test.tsx 中可能引用了旧 props 外全部通过。如有失败修复测试。

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat: App.tsx 添加 settingsOpen 状态 + 传递 onSettingsClick"
```

---

### Task 6: SettingsPanel 组件 (新增)

**Files:**
- Create: `src/app/components/SettingsPanel.tsx`
- Create: `src/app/components/SettingsPanel.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/app/components/SettingsPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";

describe("SettingsPanel", () => {
  const bridge = {
    loadSettings: vi.fn().mockResolvedValue({ baseUrl: "https://api.example.com", apiKey: "key-123", model: "claude-sonnet" }),
    saveSettings: vi.fn(),
  };

  it("renders LLM config fields and theme switch", async () => {
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={vi.fn()} theme="light" />);
    expect(screen.getByText("Base URL")).toBeInTheDocument();
    expect(screen.getByText("API Key")).toBeInTheDocument();
    expect(screen.getByText("模型")).toBeInTheDocument();
    expect(screen.getByText("主题")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "浅色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暗色" })).toBeInTheDocument();
  });

  it("calls onClose when clicking overlay", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsPanel bridge={bridge} onClose={onClose} onThemeChange={vi.fn()} theme="light" />);
    await user.click(document.querySelector(".settings-overlay")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onThemeChange with mode", async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    render(<SettingsPanel bridge={bridge} onClose={vi.fn()} onThemeChange={onThemeChange} theme="light" />);
    await user.click(screen.getByRole("button", { name: "暗色" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });
});
```

运行: `npm test -- src/app/components/SettingsPanel.test.tsx`
预期: FAIL

- [ ] **Step 2: 实现 SettingsPanel 组件**

创建 `src/app/components/SettingsPanel.tsx`:

```tsx
import { useEffect, useState } from "react";

type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type SettingsBridge = {
  loadSettings: () => Promise<SettingsFormValues>;
  saveSettings: (settings: SettingsFormValues) => unknown;
};

type Props = {
  bridge: SettingsBridge;
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
};

export function SettingsPanel({ bridge, onClose, onThemeChange, theme }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    bridge.loadSettings().then((s) => {
      setBaseUrl(s.baseUrl || "");
      setApiKey(s.apiKey || "");
      setModel(s.model || "");
    });
  }, [bridge]);

  function handleSave() {
    bridge.saveSettings({ baseUrl, apiKey, model });
  }

  return (
    <div className="settings-overlay open" onClick={onClose} role="presentation">
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="setting-row">
          <div className="setting-label">Base URL</div>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} onBlur={handleSave} placeholder="https://api.anthropic.com" />
        </div>
        <div className="setting-row">
          <div className="setting-label">API Key</div>
          <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={handleSave} placeholder="sk-ant-api-..." />
        </div>
        <div className="setting-row">
          <div className="setting-label">模型</div>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)} onBlur={handleSave} placeholder="claude-sonnet-4-6" />
        </div>
        <div className="setting-divider" />
        <div className="setting-row-inline">
          <div className="setting-label">主题</div>
          <div className="theme-switch">
            <button className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")}>浅色</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")}>暗色</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 添加 CSS**

```css
.settings-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 50;
}

.settings-overlay.open {
  display: block;
}

.settings-panel {
  position: fixed;
  left: 10px;
  bottom: 56px;
  z-index: 51;
  width: 240px;
  padding: 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  display: grid;
  gap: 12px;
}

.settings-panel .setting-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-panel .setting-label {
  font-size: var(--font-sm);
  font-weight: 520;
}

.settings-panel input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-sm);
  font-family: var(--font-mono);
}

.settings-panel input:focus {
  border-color: var(--accent);
  outline: none;
}

.settings-panel .setting-row-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.settings-panel .setting-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 2px 0;
}

.theme-switch {
  display: flex;
  gap: 1px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.theme-switch button {
  padding: 4px 10px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  cursor: pointer;
}

.theme-switch button.active {
  background: var(--bg-sidebar-active);
  color: var(--text-primary);
  font-weight: 600;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- src/app/components/SettingsPanel.test.tsx
```
预期: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/SettingsPanel.tsx src/app/components/SettingsPanel.test.tsx src/ui/styles.css
git commit -m "feat: 新增 SettingsPanel 设置浮层面板 — LLM 配置 + 主题切换"
```

---

### Task 7: 集成 SettingsPanel 到 App.tsx

**Files:**
- Modify: `src/app/App.tsx` (添加 theme 状态, SettingsPanel 渲染)

- [ ] **Step 1: 在 App.tsx 中添加 theme 状态和 SettingsPanel**

```tsx
const [theme, setTheme] = useState<"light" | "dark">("light");

useEffect(() => {
  document.documentElement.classList.toggle("dark", theme === "dark");
}, [theme]);
```

在 return 中添加:

```tsx
{settingsOpen ? (
  <SettingsPanel
    bridge={bridge}
    onClose={() => setSettingsOpen(false)}
    onThemeChange={(mode) => setTheme(mode)}
    theme={theme}
  />
) : null}
```

- [ ] **Step 2: 运行全量测试**

```bash
npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat: 集成 SettingsPanel 到 App — 主题切换 + LLM 配置"
```

---

### Task 8: 更新 Composer 布局 — absolute → grid 流

**Files:**
- Modify: `src/ui/styles.css` (`.composer-shell`)

- [ ] **Step 1: 更新 CSS**

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

.composer-shell:focus-within {
  border-color: var(--accent);
  box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent);
}

.composer-shell textarea {
  width: 100%;
  background: transparent;
  border: 0;
  outline: 0;
  resize: none;
  color: var(--text-primary);
  font-size: var(--font-md);
  line-height: 1.55;
  padding: 0;
}

.composer-shell textarea::placeholder {
  color: var(--text-tertiary);
}

.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.composer-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 31px; height: 31px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.icon-button:hover {
  background: var(--bg-sidebar-hover);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.icon-button:active { transform: scale(0.96); }

.model-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 31px;
  padding: 0 10px;
  border: 1px solid var(--border-pill);
  border-radius: var(--radius-md);
  background: var(--bg-pill);
  color: #465369;
  font-size: var(--font-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.model-pill:hover {
  background: #dce2ec;
  border-color: #c8d0de;
}

.composer-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 31px; height: 31px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  transition: all var(--transition-fast);
}

.composer-send:hover { background: var(--accent-hover); }
.composer-send:active { transform: scale(0.93); background: var(--accent-active); }
```

- [ ] **Step 2: 运行测试**

```bash
npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/styles.css
git commit -m "refactor: Composer 布局从 absolute 改为 grid 流, 新增 focus-within 光环"
```

---

### Task 9: 更新 MessageStream — 用户气泡无头像 + 更新组件测试

**Files:**
- Modify: `src/app/components/MessageStream.tsx` (移除 user-bubble 中的 avatar)
- Modify: `src/app/components/MessageStream.test.tsx` (适配)

- [ ] **Step 1: 更新测试**

编辑 `src/app/components/MessageStream.test.tsx`，移除 profile-avatar 相关断言:

```tsx
// Replace: expect(screen.getByText("测")).toBeInTheDocument();
// With: expect(screen.getByText("这是用户问题")).toBeInTheDocument();
```

- [ ] **Step 2: 更新 MessageStream 组件**

```tsx
// 用户消息改为纯文字气泡
{message.role === "user" ? (
  <div className="user-bubble">{message.content}</div>
) : (...)}
```

- [ ] **Step 3: 更新 CSS**

```css
.user-bubble {
  max-width: 560px;
  padding: 10px 14px;
  background: var(--bg-bubble);
  border-radius: var(--radius-xl);
  font-size: var(--font-md);
  line-height: 1.55;
  color: var(--text-primary);
}
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- src/app/components/MessageStream.test.tsx
```
预期: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/MessageStream.tsx src/app/components/MessageStream.test.tsx src/ui/styles.css
git commit -m "refactor: MessageStream 用户气泡移除头像 — Claude Desktop 原生风格"
```

---

### Task 10: ThinkingBlock 组件 (新增)

**Files:**
- Create: `src/app/components/ThinkingBlock.tsx`
- Create: `src/app/components/ThinkingBlock.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/app/components/ThinkingBlock.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThinkingBlock } from "./ThinkingBlock";

describe("ThinkingBlock", () => {
  it("renders collapsed by default", () => {
    render(<ThinkingBlock duration="1.2s">推理内容</ThinkingBlock>);
    expect(screen.getByText("思考中…")).toBeInTheDocument();
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.queryByText("推理内容")).not.toBeVisible();
  });

  it("expands on click", async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock duration="0.8s">选择 B 方案</ThinkingBlock>);
    await user.click(screen.getByText("思考中…"));
    expect(screen.getByText("选择 B 方案")).toBeVisible();
  });
});
```

运行: `npm test -- src/app/components/ThinkingBlock.test.tsx`
预期: FAIL

- [ ] **Step 2: 实现 ThinkingBlock 组件**

创建 `src/app/components/ThinkingBlock.tsx`:

```tsx
import { useState } from "react";
import { ActivityIndicator } from "./ActivityIndicator";

type Props = {
  duration: string;
  children: React.ReactNode;
};

export function ThinkingBlock({ duration, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="thinking-block">
      <div
        className={`thinking-header ${open ? "expanded" : ""}`}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ActivityIndicator status="active" />
        <span className="thinking-label">思考中…</span>
        <span className="thinking-time">{duration}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div className={`thinking-body ${open ? "open" : ""}`}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: 添加 CSS**

```css
.thinking-block {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.thinking-block:hover { border-color: var(--border-strong); }

.thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.thinking-header:hover { background: var(--bg-sidebar); }

.thinking-header .thinking-label {
  font-weight: 520;
  color: var(--text-primary);
}

.thinking-header .thinking-time {
  color: var(--text-tertiary);
  font-size: var(--font-xs);
  margin-left: auto;
}

.thinking-header svg {
  flex: none;
  transition: transform var(--transition-fast);
}

.thinking-header.expanded svg { transform: rotate(180deg); }

.thinking-body {
  display: none;
  padding: 10px 12px 12px;
  font-size: var(--font-sm);
  line-height: 1.55;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-sidebar);
}

.thinking-body.open { display: block; }
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- src/app/components/ThinkingBlock.test.tsx
```
预期: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/ThinkingBlock.tsx src/app/components/ThinkingBlock.test.tsx src/ui/styles.css
git commit -m "feat: 新增 ThinkingBlock LLM 思考过程可折叠组件"
```

---

### Task 11: ToolCallCard 组件 (新增)

**Files:**
- Create: `src/app/components/ToolCallCard.tsx`
- Create: `src/app/components/ToolCallCard.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/app/components/ToolCallCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToolCallCard } from "./ToolCallCard";

describe("ToolCallCard", () => {
  it("renders tool name with active indicator and status", () => {
    render(<ToolCallCard toolName="Read" summary="src/test.ts" status="active" statusText="执行中…" />);
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("src/test.ts")).toBeInTheDocument();
    expect(screen.getByText("执行中…")).toBeInTheDocument();
  });

  it("renders done status with timing", () => {
    render(<ToolCallCard toolName="Bash" summary="npm test" status="done" statusText="42ms" />);
    expect(screen.getByText("42ms")).toBeInTheDocument();
  });

  it("toggles output on click", async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolName="Read" summary="test.ts" status="done" statusText="3ms" output="文件内容…" />);
    await user.click(screen.getByText("查看输出"));
    expect(screen.getByText("文件内容…")).toBeVisible();
  });
});
```

运行: `npm test -- src/app/components/ToolCallCard.test.tsx`
预期: FAIL

- [ ] **Step 2: 实现 ToolCallCard 组件**

创建 `src/app/components/ToolCallCard.tsx`:

```tsx
import { useState } from "react";
import { ActivityIndicator } from "./ActivityIndicator";

type Props = {
  toolName: string;
  summary: string;
  status: "idle" | "active" | "done" | "error";
  statusText: string;
  output?: string;
  outputLabel?: string;
};

export function ToolCallCard({ toolName, summary, status, statusText, output, outputLabel = "查看输出" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="tool-call-card">
      <div className="tool-call-body">
        <div className="tool-call-header">
          <ActivityIndicator status={status} />
          <span className="tool-call-tool-name">{toolName}</span>
          <span className="tool-call-summary">{summary}</span>
          <span className="tool-call-status">{statusText}</span>
        </div>
        {output ? (
          <>
            <button
              className={`tool-call-toggle ${open ? "expanded" : ""}`}
              type="button"
              onClick={() => setOpen((v) => !v)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {outputLabel}
            </button>
            <pre className={`tool-call-detail is-output ${open ? "open" : ""}`}>{output}</pre>
          </>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 添加 CSS**

```css
.tool-call-card { padding: 7px 0; }

.tool-call-body {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-sm);
  font-family: var(--font-mono);
  line-height: 1.25;
}

.tool-call-tool-name {
  font-weight: 620;
  color: var(--text-primary);
}

.tool-call-summary {
  color: var(--text-secondary);
  font-weight: 420;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-call-status {
  font-size: var(--font-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  flex: none;
}

.tool-call-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--font-xs);
  cursor: pointer;
  width: fit-content;
}

.tool-call-toggle:hover { color: var(--text-secondary); }

.tool-call-toggle svg { transition: transform var(--transition-fast); }
.tool-call-toggle.expanded svg { transform: rotate(180deg); }

.tool-call-detail {
  display: none;
  margin-top: 2px;
  padding: 10px 14px;
  background: var(--bg-sidebar);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow: auto;
  max-height: 160px;
}

.tool-call-detail.open { display: block; }
.tool-call-detail.is-output { color: var(--text-primary); }
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- src/app/components/ToolCallCard.test.tsx
```
预期: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/ToolCallCard.tsx src/app/components/ToolCallCard.test.tsx src/ui/styles.css
git commit -m "feat: 新增 ToolCallCard 工具调用内联卡片组件"
```

---

### Task 12: 重写 ToolApprovalCard — 深色迷你终端风格

**Files:**
- Modify: `src/app/components/ToolApprovalCard.tsx` (全面重写)
- Modify: `src/app/components/ToolApprovalCard.test.tsx` (适配新 DOM 和交互)

- [ ] **Step 1: 更新测试**

编辑 `src/app/components/ToolApprovalCard.test.tsx`，适配终端风格 class 名和新的按钮交互逻辑:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolApprovalCard } from "./ToolApprovalCard";

const request = {
  runId: "run-1",
  requestId: "approval-1",
  toolCall: {
    id: "approval-1",
    toolName: "browser.navigate",
    label: "浏览器导航",
    status: "waiting_approval" as const,
    inputSummary: "目标：/orders?status=pending_payment\n操作：读取页面状态，不修改业务数据",
    approvalReason: "打开订单列表页，并检查待支付状态筛选是否正确。",
  },
};

describe("ToolApprovalCard", () => {
  it("renders terminal-style approval with tool name", () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(<ToolApprovalCard request={request} onApprove={onApprove} onDeny={onDeny} />);

    expect(screen.getByText(/browser.navigate/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "允许一次" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "本会话允许" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeInTheDocument();
  });

  it("highlights selected button and disables others on allow once", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(<ToolApprovalCard request={request} onApprove={onApprove} onDeny={onDeny} />);

    await user.click(screen.getByRole("button", { name: "允许一次" }));
    expect(onApprove).toHaveBeenCalledWith("run-1", "approval-1", { updatedInput: undefined, applyPermissionSuggestions: false });

    // Clicked button stays enabled and gets is-selected
    const allowOnceBtn = screen.getByRole("button", { name: "允许一次" });
    expect(allowOnceBtn).not.toBeDisabled();
    expect(allowOnceBtn).toHaveClass("is-selected");

    // Other buttons disabled
    expect(screen.getByRole("button", { name: "本会话允许" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeDisabled();
  });

  it("highlights deny and disables others on deny", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(<ToolApprovalCard request={request} onApprove={onApprove} onDeny={onDeny} />);

    await user.click(screen.getByRole("button", { name: "拒绝" }));
    expect(onDeny).toHaveBeenCalledWith("run-1", "approval-1", "用户拒绝了此次工具调用");

    expect(screen.getByRole("button", { name: "拒绝" })).toHaveClass("is-selected");
    expect(screen.getByRole("button", { name: "允许一次" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "本会话允许" })).toBeDisabled();
  });
});
```

运行: `npm test -- src/app/components/ToolApprovalCard.test.tsx`
预期: FAIL

- [ ] **Step 2: 重写 ToolApprovalCard 组件**

```tsx
import { useState } from "react";
import { ActivityIndicator } from "./ActivityIndicator";
import type { ApprovalRequest } from "../sdkUiTypes";

type Props = {
  request: ApprovalRequest;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
};

function inputSummaryText(request: ApprovalRequest) {
  const summary = request.toolCall.inputSummary?.trim();
  if (summary) return `工具：${request.toolCall.toolName}\n${summary}`;
  return `工具：${request.toolCall.toolName}`;
}

export function ToolApprovalCard({ request, onApprove, onDeny }: Props) {
  const [selected, setSelected] = useState<"allow-once" | "allow-session" | "denied" | null>(null);

  function handleApprove(applyPermissionSuggestions: boolean) {
    setSelected(applyPermissionSuggestions ? "allow-session" : "allow-once");
    onApprove(request.runId, request.requestId, { updatedInput: undefined, applyPermissionSuggestions });
  }

  function handleDeny() {
    setSelected("denied");
    onDeny(request.runId, request.requestId, "用户拒绝了此次工具调用");
  }

  return (
    <div className="approval-card">
      <div className="term-line">
        <ActivityIndicator status={selected === "denied" ? "error" : selected ? "done" : "active"} />
        <span className="term-prompt">$</span>
        <span className="term-text">ai-assistant request {request.toolCall.toolName}</span>
      </div>
      <div className="term-line">
        <span className="term-prompt">&gt;</span>
        <span className="term-text">{request.toolCall.approvalReason?.trim() || `${request.toolCall.label} 请求执行工具调用。`}</span>
      </div>
      <pre className="term-block">{inputSummaryText(request)}</pre>
      <div className="term-actions">
        <button
          className={`approval-btn ${selected === "allow-once" ? "is-selected" : ""}`}
          type="button"
          onClick={() => handleApprove(false)}
          disabled={selected !== null && selected !== "allow-once"}
        >
          允许一次
        </button>
        <button
          className={`approval-btn ${selected === "allow-session" ? "is-selected" : ""}`}
          type="button"
          onClick={() => handleApprove(true)}
          disabled={selected !== null && selected !== "allow-session"}
        >
          本会话允许
        </button>
        <button
          className={`approval-btn ${selected === "denied" ? "is-selected" : ""}`}
          type="button"
          onClick={handleDeny}
          disabled={selected !== null && selected !== "denied"}
        >
          拒绝
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 添加 CSS**

```css
.approval-card {
  background: #1e1d1a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-xl);
  padding: 16px;
  display: grid;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
  color: #d4d1c8;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}

.approval-card .term-line {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.approval-card .term-prompt {
  color: #788c5d;
  flex: none;
  font-weight: 600;
}

.approval-card .term-text {
  color: #d4d1c8;
}

.approval-card .term-block {
  margin: 0;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  color: rgba(255,255,255,0.6);
  white-space: pre-wrap;
  overflow: auto;
  max-height: 140px;
}

.approval-card .term-actions {
  display: flex;
  gap: 8px;
}

.approval-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  min-height: 34px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: var(--radius-md);
  background: transparent;
  color: rgba(255,255,255,0.7);
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.approval-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.3);
  color: #fff;
}

.approval-btn:disabled {
  opacity: 0.2;
  cursor: default;
  pointer-events: none;
}

.approval-btn.is-selected {
  border-color: rgba(255,255,255,0.45);
  color: #fff;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- src/app/components/ToolApprovalCard.test.tsx
```
预期: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/ToolApprovalCard.tsx src/app/components/ToolApprovalCard.test.tsx src/ui/styles.css
git commit -m "refactor: ToolApprovalCard 重做为深色迷你终端风格 + 按钮选中高亮交互"
```

---

### Task 13: 更新 ConversationPane 测试 + 确保全量测试通过

**Files:**
- Modify: `src/app/components/ConversationPane.test.tsx` (适配新布局)
- Modify: `src/app/App.test.tsx` (适配新 props)

- [ ] **Step 1: 运行全量测试，查看失败列表**

```bash
npm test
```

- [ ] **Step 2: 逐个修复失败测试**

需要关注的测试:
- `ConversationPane.test.tsx` — 可能因 `onSettingsClick` 新 prop 报错
- `App.test.tsx` — 可能因 `ClaudeSidebar` 新 props 报错
- E2E 测试色值断言需更新

按需逐个修复:
1. 补充缺失的 props
2. 更新硬编码色值断言 (如 `rgb(253, 251, 247)` → `rgb(250, 249, 245)`)
3. 更新 sidebar 宽度断言 (252px → 260px)

- [ ] **Step 3: 确认全量通过**

```bash
npm test
```
预期: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "test: 更新 ConversationPane/App 测试适配新组件接口和色值"
```

---

### Task 14: 更新 E2E 测试色值和布局断言

**Files:**
- Modify: `tests/e2e/claude-desktop-ui-redesign.spec.ts`
- Modify: `tests/e2e/ai-test-flow.spec.ts`

- [ ] **Step 1: 更新色值断言**

编辑 E2E 测试中硬编码的 `rgb()` 色值:

```ts
// 原: background-color: rgb(244, 239, 231)  (#f4efe7)
// 改: background-color: rgb(232, 230, 220)  (#e8e6dc)
await expect(page.locator(".claude-sidebar")).toHaveCSS("background-color", "rgb(232, 230, 220)");

// 原: background-color: rgb(253, 251, 247)  (#fdfbf7)
// 改: background-color: rgb(250, 249, 245)  (#faf9f5)
await expect(page.locator(".app-shell")).toHaveCSS("background-color", "rgb(250, 249, 245)");
```

- [ ] **Step 2: 运行 E2E 测试**

```bash
npm run e2e
```
预期: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/
git commit -m "test: 更新 E2E 色值断言匹配新设计 token"
```

---

### Task 15: 最终验证 + 全量测试

- [ ] **Step 1: 全量单元测试**

```bash
npm test
```
预期: ALL PASS

- [ ] **Step 2: E2E 测试**

```bash
npm run e2e
```
预期: ALL PASS

- [ ] **Step 3: 类型检查 + 构建**

```bash
npm run build
```
预期: 无类型错误，构建成功

- [ ] **Step 4: 手动验证清单**

在浏览器中验证 `npm run dev`:
- [ ] 浅色/暗色模式切换正常
- [ ] 消息流滚动不溢出
- [ ] 侧边栏会话滚动不与设置按钮重叠
- [ ] 审批卡片按钮交互: 选中高亮 + 其他置灰
- [ ] 工具调用 indicator 正确显示四种状态
- [ ] Thinking block 折叠/展开正常
- [ ] Header 渐变过渡自然
- [ ] 设置面板弹出位置正确

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: Claude Desktop UI 1:1 像素级复刻 — 全部组件和测试更新完成"
```
