# Claude Desktop 高保真 UI 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按最新高保真原型和 `docs/superpowers/specs/2026-05-24-claude-desktop-ui-redesign-design.md` 重构 Electron/React 前端，使普通聊天与测试执行模式都达到 Claude Desktop 风格，并用 Claude Code 风格审核卡承载工具审批。

**Architecture:** 保留现有单页 Electron + React 架构，继续使用 `SdkUiState` 和 `reduceSdkUiEvent` 驱动 UI 模式。新增窗口控制 IPC 与 `WindowControls` 组件，主工作区拆为明确的侧栏、会话区、消息流、输入框、审核卡和测试监控台，所有高保真视觉由 `src/ui/styles.css` 的统一 CSS 变量与类名控制。

**Tech Stack:** Electron 42、Vite 6、React 19、TypeScript、Vitest、React Testing Library、Playwright、lucide-react、普通 CSS。

---

## Source Inputs

- 设计文档：`docs/superpowers/specs/2026-05-24-claude-desktop-ui-redesign-design.md`
- 高保真 HTML：`.superpowers/previews/claude-desktop-ui-redesign-v5.html`
- 最新预览截图：`.superpowers/previews/claude-desktop-ui-redesign-v9-chat-review-card.png`
- 当前入口：`src/app/App.tsx`
- 当前全局样式：`src/ui/styles.css`

## File Structure

- Modify: `electron/main.ts`
  - 隐藏原生菜单。
  - 创建 frameless BrowserWindow。
  - 注册窗口最小化、最大化/还原、关闭 IPC。
- Modify: `electron/main.test.ts`
  - 验证菜单隐藏、frameless 窗口、窗口控制 IPC。
- Modify: `src/ipc/channels.ts`
  - 增加窗口控制 renderer-to-main channel。
- Modify: `src/ipc/payloadSchemas.ts`
  - 为窗口控制 channel 增加无 payload schema。
- Modify: `src/ipc/channels.test.ts`
  - 验证窗口控制 channel 在允许列表中。
- Modify: `src/ipc/payloadSchemas.test.ts`
  - 验证窗口控制 channel 不接受对象 payload。
- Modify: `src/app/backendBridge.ts`
  - 暴露 `minimizeWindow`、`toggleMaximizeWindow`、`closeWindow`。
- Modify: `src/app/backendBridge.test.ts`
  - 验证 bridge 发送窗口控制 channel。
- Create: `src/app/components/WindowControls.tsx`
  - 渲染主聊天区右上角三个窗口按钮。
- Create: `src/app/components/WindowControls.test.tsx`
  - 验证中文 aria-label 和点击回调。
- Modify: `src/app/components/ClaudeSidebar.tsx`
  - 品牌改为“AI 测试助手”。
  - 删除“查看全部”入口。
  - 最近为空时显示“暂无最近对话”。
- Modify: `src/app/components/ClaudeSidebar.test.tsx`
  - 覆盖品牌、导航、最近、空态、无“查看全部”。
- Create: `src/app/components/EmptyConversationState.tsx`
  - 普通新会话空态。
- Create: `src/app/components/EmptyConversationState.test.tsx`
  - 验证中文引导与建议入口。
- Create: `src/app/components/ConversationPane.tsx`
  - 组织会话标题、窗口控制、消息流、计划执行按钮、空态和输入框。
- Create: `src/app/components/ConversationPane.test.tsx`
  - 验证标题无下拉、普通空态、测试模式输入框文案、窗口按钮位置语义。
- Modify: `src/app/App.tsx`
  - 使用 `ConversationPane`。
  - 移除 `onViewAll`。
  - 保持 `shouldShowTestConsole` 派生规则。
- Modify: `src/app/App.test.tsx`
  - 更新新文案与高保真行为断言。
- Modify: `src/app/components/MessageStream.tsx`
  - 用户头像进入气泡内部。
  - 助手回复只显示复制、重试。
  - 不再直接暴露 SDK raw/usage details 到主消息流。
- Modify: `src/app/components/MessageStream.test.tsx`
  - 验证消息列内容、无点赞/点踩/收藏、无 SDK Raw。
- Modify: `src/app/components/ToolApprovalCard.tsx`
  - 改为 Claude Code 风格审核卡。
  - 支持“查看详情”折叠。
  - 支持“允许一次”“本会话允许”“拒绝”。
  - 支持完成态。
- Modify: `src/app/components/ToolApprovalCard.test.tsx`
  - 覆盖工具意图、输入摘要、影响范围、详情切换、三种决策。
- Modify: `src/app/components/Composer.tsx`
  - placeholder 改为中文产品口径。
  - 按钮 aria-label 保持中文。
- Modify: `src/app/components/Composer.test.tsx`
  - 覆盖中文 placeholder 和提交行为。
- Modify: `src/app/components/TestConsole.tsx`
  - 高保真“测试监控台”卡片、进度条、状态中文化、底部控制。
- Modify: `src/app/components/TestConsole.test.tsx`
  - 覆盖进度、MCP 服务、证据、缺陷草稿、按钮。
- Modify: `src/ui/styles.css`
  - 按高保真原型整体替换 CSS。
- Create: `tests/e2e/claude-desktop-ui-redesign.spec.ts`
  - 验证普通聊天、测试执行、审核卡、无菜单式顶部栏、核心 CSS。

## High-Fidelity CSS Contract

`src/ui/styles.css` 最终必须覆盖以下 UI 元素。实现时可按任务递进写入，但最终文件中的选择器与视觉值必须与本合同一致。

```css
:root {
  --paper: #fdfbf7;
  --sidebar: #f4efe7;
  --sidebar-strong: #eadbcc;
  --line: #e5ded3;
  --line-strong: #ddd5ca;
  --text: #292520;
  --muted: #6f675e;
  --muted-2: #8a837b;
  --orange: #d96f4f;
  --orange-soft: #d98b72;
  --bubble: #f1eee9;
  --card: #fffefb;
  --blue-pill: #eef1f6;
  color: var(--text);
  background: var(--paper);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 1040px;
  min-height: 100vh;
  background: var(--paper);
}

button,
textarea,
select,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

button:focus-visible,
textarea:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid var(--orange-soft);
  outline-offset: 2px;
}

.app-shell {
  display: grid;
  height: 100vh;
  background: var(--paper);
  color: var(--text);
}

.app-shell.chat-mode {
  grid-template-columns: 252px minmax(0, 1fr);
}

.app-shell.test-mode {
  grid-template-columns: 252px minmax(0, 1fr) 300px;
}

.claude-sidebar {
  background: var(--sidebar);
  border-right: 1px solid var(--line);
  display: grid;
  grid-template-rows: 68px auto 1fr auto;
  min-width: 0;
}

.claude-brand {
  align-items: center;
  border-bottom: 1px solid var(--line);
  display: flex;
  gap: 10px;
  padding: 0 20px;
  font-size: 20px;
  font-weight: 650;
}

.claude-brand-icon,
.assistant-mark {
  color: var(--orange);
  flex: none;
}

.claude-nav,
.recent-section {
  display: grid;
  gap: 7px;
  padding: 14px 10px 0;
}

.claude-nav-item,
.recent-session {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: #514b43;
  display: flex;
  gap: 12px;
  height: 36px;
  justify-content: flex-start;
  padding: 0 12px;
  text-align: left;
  font-size: 14px;
  line-height: 1;
}

.claude-nav-item.active,
.recent-session.active {
  background: var(--sidebar-strong);
  color: #2d2924;
  font-weight: 650;
}

.claude-nav-item svg {
  color: #514b43;
  flex: none;
  stroke-width: 1.65;
}

.recent-section {
  align-content: start;
  gap: 2px;
  padding: 14px 10px;
}

.recent-title {
  color: #756d63;
  font-size: 12px;
  margin: 0;
  padding: 0 12px 6px;
}

.recent-session {
  height: 34px;
  gap: 0;
  font-size: 13px;
}

.recent-empty {
  color: var(--muted);
  font-size: 13px;
  padding: 8px 12px;
}

.claude-profile {
  align-items: center;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 10px;
  padding: 14px 18px;
}

.profile-avatar {
  align-items: center;
  background: #191715;
  border-radius: 999px;
  color: #fff;
  display: inline-flex;
  flex: none;
  font-size: 12px;
  height: 30px;
  justify-content: center;
  width: 30px;
}

.profile-copy {
  display: grid;
  gap: 2px;
  margin-right: auto;
}

.profile-copy strong {
  font-size: 13px;
}

.profile-copy span {
  color: #766e65;
  font-size: 12px;
}

.conversation {
  background: var(--paper);
  display: grid;
  grid-template-rows: 54px minmax(0, 1fr);
  min-width: 0;
  position: relative;
}

.conversation-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 0 12px 0 26px;
  -webkit-app-region: drag;
}

.conversation-title {
  background: transparent;
  border: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 650;
  padding: 0;
  pointer-events: none;
}

.window-controls {
  align-items: center;
  color: #4f4840;
  display: flex;
  flex: none;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.window-control {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: inherit;
  display: inline-flex;
  height: 32px;
  justify-content: center;
  padding: 0;
  width: 32px;
}

.window-control:hover {
  background: #eee7dd;
}

.window-control.close:hover {
  background: #f3ded8;
  color: #9e3326;
}

.message-stream {
  align-content: start;
  display: grid;
  gap: 15px;
  justify-items: center;
  overflow: auto;
  padding: 18px 0 132px;
}

.chat-mode .message-column,
.chat-mode .message {
  width: min(650px, calc(100% - 72px));
}

.test-mode .message-column,
.test-mode .message {
  width: min(610px, calc(100% - 56px));
}

.message-column {
  display: grid;
  gap: 15px;
  align-content: start;
}

.message {
  max-width: 650px;
}

.message.user-message {
  display: flex;
  justify-content: flex-start;
}

.user-bubble {
  align-items: flex-start;
  background: var(--bubble);
  border-radius: 13px;
  display: flex;
  gap: 12px;
  line-height: 1.58;
  max-width: 560px;
  padding: 10px 14px 10px 10px;
}

.user-bubble .profile-avatar {
  height: 28px;
  margin-top: 1px;
  width: 28px;
}

.assistant-message {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
  display: grid;
  gap: 12px;
  grid-template-columns: 26px 1fr;
  line-height: 1.72;
  padding: 15px 16px 13px;
}

.assistant-message p {
  margin: 0;
}

.assistant-message ol,
.assistant-message ul {
  margin: 10px 0 0;
  padding-left: 20px;
}

.assistant-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: 14px;
}

.assistant-actions button {
  align-items: center;
  background: transparent;
  border: 0;
  color: var(--muted);
  display: inline-flex;
  font-size: 12px;
  gap: 5px;
  padding: 0;
}

.empty-state {
  display: grid;
  gap: 18px;
  justify-items: center;
  margin-top: 96px;
  text-align: center;
  width: min(560px, calc(100% - 72px));
}

.empty-icon {
  align-items: center;
  background: #f3ece2;
  border: 1px solid var(--line);
  border-radius: 14px;
  color: var(--orange);
  display: inline-flex;
  height: 38px;
  justify-content: center;
  width: 38px;
}

.empty-state h2 {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0;
  margin: 0;
}

.empty-state p {
  color: var(--muted);
  font-size: 14px;
  margin: 0;
}

.suggestions {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 4px;
  width: 100%;
}

.suggestion {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  color: #4f4a44;
  font-size: 13px;
  line-height: 1.45;
  padding: 11px 12px;
  text-align: left;
}

.review-card {
  background: #fffdf9;
  border: 1px solid #e6d9ca;
  border-radius: 12px;
  display: grid;
  gap: 12px;
  font-size: 13px;
  line-height: 1.55;
  padding: 14px 16px;
}

.review-head {
  align-items: flex-start;
  display: flex;
  gap: 10px;
}

.review-icon {
  align-items: center;
  background: #f6eee5;
  border: 1px solid #ead9c7;
  border-radius: 8px;
  color: var(--orange);
  display: inline-flex;
  flex: none;
  height: 28px;
  justify-content: center;
  width: 28px;
}

.review-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.review-copy strong {
  font-size: 14px;
  font-weight: 650;
}

.review-copy span {
  color: var(--muted);
  font-size: 12px;
}

.review-status {
  background: #fbf5ee;
  border: 1px solid #e4d7c9;
  border-radius: 999px;
  color: #7a6254;
  flex: none;
  font-size: 12px;
  margin-left: auto;
  padding: 3px 8px;
}

.review-summary,
.review-impact {
  color: #4f4942;
  margin: 0;
}

.review-code {
  background: #f7f1ea;
  border: 1px solid #e7ded2;
  border-radius: 9px;
  color: #3a342e;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.55;
  margin: 0;
  padding: 9px 10px;
  white-space: pre-wrap;
}

.review-detail {
  align-items: center;
  background: transparent;
  border: 0;
  color: var(--muted);
  display: inline-flex;
  font-size: 12px;
  gap: 5px;
  padding: 0;
  width: fit-content;
}

.review-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-button {
  background: var(--card);
  border: 1px solid #dfd5c8;
  border-radius: 8px;
  color: #4f4942;
  font-size: 13px;
  min-height: 34px;
  padding: 0 10px;
}

.review-button.primary {
  background: var(--orange-soft);
  border-color: var(--orange-soft);
  color: #fff;
}

.review-button.session {
  background: #f3ece4;
}

.review-button.deny {
  color: #70584d;
}

.review-card.completed .review-button {
  opacity: 0.6;
  pointer-events: none;
}

.composer-shell {
  background: var(--card);
  border: 1px solid #dfd9d0;
  border-radius: 12px;
  bottom: 18px;
  box-shadow: 0 8px 24px rgba(50, 38, 25, 0.085);
  display: grid;
  grid-template-rows: 1fr auto;
  height: 86px;
  left: 50%;
  padding: 14px 14px 12px;
  position: absolute;
  transform: translateX(-50%);
  width: min(670px, calc(100% - 92px));
}

.test-mode .composer-shell {
  width: min(610px, calc(100% - 52px));
}

.composer-shell textarea {
  background: transparent;
  border: 0;
  color: var(--text);
  outline: 0;
  resize: none;
}

.composer-shell textarea::placeholder {
  color: var(--muted-2);
}

.composer-toolbar,
.composer-tools {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.composer-tools {
  gap: 8px;
}

.icon-button,
.composer-send {
  align-items: center;
  border-radius: 8px;
  display: inline-flex;
  height: 31px;
  justify-content: center;
  width: 31px;
}

.icon-button {
  background: var(--card);
  border: 1px solid #e2dcd4;
  color: #4f4a44;
}

.composer-send {
  background: var(--orange-soft);
  border: 0;
  color: #fff;
}

.model-pill {
  align-items: center;
  background: var(--blue-pill);
  border: 1px solid #dce2ec;
  border-radius: 8px;
  color: #465369;
  display: inline-flex;
  font-size: 12px;
  gap: 6px;
  height: 31px;
  padding: 0 10px;
}

.plan-action-row {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.primary-action,
.secondary-action {
  border-radius: 8px;
  min-height: 34px;
  padding: 0 12px;
}

.primary-action {
  background: var(--orange-soft);
  border: 0;
  color: #fff;
}

.secondary-action {
  background: var(--card);
  border: 1px solid var(--line-strong);
  color: #4f4a44;
}

.test-console {
  background: #faf7f1;
  border-left: 1px solid var(--line);
  display: grid;
  grid-template-rows: 54px 1fr auto;
  min-width: 0;
}

.test-console-header {
  align-items: center;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  padding: 0 16px;
}

.test-console-header h2 {
  font-size: 14px;
  font-weight: 650;
  margin: 0;
}

.test-console-body {
  align-content: start;
  display: grid;
  gap: 12px;
  overflow: auto;
  padding: 14px;
}

.monitor-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 11px;
  display: grid;
  gap: 8px;
  padding: 12px;
}

.monitor-card h3 {
  font-size: 13px;
  font-weight: 650;
  margin: 0;
}

.monitor-card p,
.monitor-row {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
}

.monitor-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.progress {
  background: #ece3d7;
  border-radius: 99px;
  height: 7px;
  overflow: hidden;
}

.progress span {
  background: var(--orange-soft);
  display: block;
  height: 100%;
}

.test-console-footer {
  align-items: center;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 8px;
  padding: 12px 14px 14px;
}

.test-console-footer .primary-action {
  flex: 1;
}

.test-console-footer .secondary-action {
  width: 64px;
}

.sdk-error,
.sdk-task {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 1120px) {
  body {
    min-width: 0;
  }

  .app-shell.test-mode {
    grid-template-columns: 252px minmax(0, 1fr);
  }

  .app-shell.test-mode .test-console {
    display: none;
  }
}
```

---

### Task 1: Electron Window Chrome and IPC

**Files:**
- Modify: `src/ipc/channels.ts`
- Modify: `src/ipc/payloadSchemas.ts`
- Modify: `src/ipc/channels.test.ts`
- Modify: `src/ipc/payloadSchemas.test.ts`
- Modify: `electron/main.ts`
- Modify: `electron/main.test.ts`

- [ ] **Step 1: Write failing channel allow-list tests**

Append this case to `src/ipc/channels.test.ts`:

```ts
it("allows renderer window control channels", () => {
  expect(isRendererToMainChannel("window:minimize")).toBe(true);
  expect(isRendererToMainChannel("window:toggle-maximize")).toBe(true);
  expect(isRendererToMainChannel("window:close")).toBe(true);
});
```

- [ ] **Step 2: Run channel test and verify RED**

Run:

```powershell
npm test -- src/ipc/channels.test.ts
```

Expected: FAIL because `window:minimize`, `window:toggle-maximize`, and `window:close` are not in `rendererToMainChannels`.

- [ ] **Step 3: Add window channels**

In `src/ipc/channels.ts`, add these strings to `rendererToMainChannels`:

```ts
  "window:minimize",
  "window:toggle-maximize",
  "window:close",
```

- [ ] **Step 4: Run channel test and verify GREEN**

Run:

```powershell
npm test -- src/ipc/channels.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing payload schema tests**

Append this case to `src/ipc/payloadSchemas.test.ts`:

```ts
it("accepts only empty payloads for window controls", () => {
  expect(() => parseRendererToMainPayload("window:minimize", undefined)).not.toThrow();
  expect(() => parseRendererToMainPayload("window:toggle-maximize", undefined)).not.toThrow();
  expect(() => parseRendererToMainPayload("window:close", undefined)).not.toThrow();

  expect(() => parseRendererToMainPayload("window:minimize", { value: true })).toThrow();
  expect(() => parseRendererToMainPayload("window:toggle-maximize", { value: true })).toThrow();
  expect(() => parseRendererToMainPayload("window:close", { value: true })).toThrow();
});
```

- [ ] **Step 6: Run payload schema test and verify RED**

Run:

```powershell
npm test -- src/ipc/payloadSchemas.test.ts
```

Expected: FAIL because `rendererSchemas` has no schema for the window control channels.

- [ ] **Step 7: Add no-payload schemas**

In `src/ipc/payloadSchemas.ts`, add these entries to `rendererSchemas`:

```ts
  "window:minimize": noPayload,
  "window:toggle-maximize": noPayload,
  "window:close": noPayload,
```

- [ ] **Step 8: Run payload schema test and verify GREEN**

Run:

```powershell
npm test -- src/ipc/payloadSchemas.test.ts
```

Expected: PASS.

- [ ] **Step 9: Write failing Electron shell tests**

Replace the Electron mock in `electron/main.test.ts` with this shape so tests can inspect menu/window behavior:

```ts
const handle = vi.fn();
const on = vi.fn();
const send = vi.fn();
const setApplicationMenu = vi.fn();
const minimize = vi.fn();
const maximize = vi.fn();
const unmaximize = vi.fn();
const close = vi.fn();
const isMaximized = vi.fn(() => false);
const browserWindowOptions: unknown[] = [];
const focusedWindow = { minimize, maximize, unmaximize, close, isMaximized };

vi.mock("electron", () => ({
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: Object.assign(
    vi.fn(function BrowserWindow(options: unknown) {
      browserWindowOptions.push(options);
      return {
        loadURL: vi.fn(),
        loadFile: vi.fn(),
        webContents: { send },
        minimize,
        maximize,
        unmaximize,
        close,
        isMaximized,
      };
    }),
    {
      getFocusedWindow: vi.fn(() => focusedWindow),
      getAllWindows: vi.fn(() => []),
    },
  ),
  Menu: { setApplicationMenu },
  ipcMain: { handle, on },
}));
```

Then add these cases:

```ts
it("hides the native menu and creates a frameless app window", async () => {
  await import("./main.js");

  expect(setApplicationMenu).toHaveBeenCalledWith(null);
  expect(browserWindowOptions[0]).toEqual(expect.objectContaining({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "AI 测试助手",
    frame: false,
  }));
});

it("registers window control handlers", async () => {
  await import("./main.js");

  const onChannels = on.mock.calls.map(([channel]) => channel);

  expect(onChannels).toContain("window:minimize");
  expect(onChannels).toContain("window:toggle-maximize");
  expect(onChannels).toContain("window:close");
});
```

- [ ] **Step 10: Run Electron main test and verify RED**

Run:

```powershell
npm test -- electron/main.test.ts
```

Expected: FAIL because `Menu.setApplicationMenu(null)`, `frame: false`, and window control handlers are not implemented.

- [ ] **Step 11: Implement Electron menu hiding and window control handlers**

Modify imports in `electron/main.ts`:

```ts
import { app, BrowserWindow, ipcMain, Menu } from "electron";
```

Add this helper above `createWindow()`:

```ts
function focusedWindow() {
  return BrowserWindow.getFocusedWindow();
}

function registerWindowControlIpc() {
  ipcMain.on("window:minimize", () => {
    focusedWindow()?.minimize();
  });

  ipcMain.on("window:toggle-maximize", () => {
    const window = focusedWindow();
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on("window:close", () => {
    focusedWindow()?.close();
  });
}
```

At the top of `createWindow()`, hide the menu and register controls:

```ts
  Menu.setApplicationMenu(null);
  registerWindowControlIpc();
```

Add `frame: false` to the `BrowserWindow` options:

```ts
    frame: false,
```

- [ ] **Step 12: Run Electron main test and verify GREEN**

Run:

```powershell
npm test -- electron/main.test.ts
```

Expected: PASS.

- [ ] **Step 13: Commit Task 1**

```powershell
git add src/ipc/channels.ts src/ipc/payloadSchemas.ts src/ipc/channels.test.ts src/ipc/payloadSchemas.test.ts electron/main.ts electron/main.test.ts
git commit -m "feat: 添加自定义窗口控制 IPC"
```

---

### Task 2: Backend Bridge and WindowControls Component

**Files:**
- Modify: `src/app/backendBridge.ts`
- Modify: `src/app/backendBridge.test.ts`
- Create: `src/app/components/WindowControls.tsx`
- Create: `src/app/components/WindowControls.test.tsx`

- [ ] **Step 1: Write failing backend bridge tests**

Append to `src/app/backendBridge.test.ts`:

```ts
it("sends window control events", () => {
  const api = {
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(() => () => undefined),
  };
  const bridge = createBackendBridge(api);

  bridge.minimizeWindow();
  bridge.toggleMaximizeWindow();
  bridge.closeWindow();

  expect(api.send).toHaveBeenCalledWith("window:minimize", undefined);
  expect(api.send).toHaveBeenCalledWith("window:toggle-maximize", undefined);
  expect(api.send).toHaveBeenCalledWith("window:close", undefined);
});
```

- [ ] **Step 2: Run bridge test and verify RED**

Run:

```powershell
npm test -- src/app/backendBridge.test.ts
```

Expected: FAIL because the bridge has no window control methods.

- [ ] **Step 3: Implement bridge methods**

In `src/app/backendBridge.ts`, add these methods to the returned object:

```ts
    minimizeWindow() {
      api.send("window:minimize", undefined);
    },
    toggleMaximizeWindow() {
      api.send("window:toggle-maximize", undefined);
    },
    closeWindow() {
      api.send("window:close", undefined);
    },
```

- [ ] **Step 4: Run bridge test and verify GREEN**

Run:

```powershell
npm test -- src/app/backendBridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing WindowControls test**

Create `src/app/components/WindowControls.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WindowControls } from "./WindowControls";

describe("WindowControls", () => {
  it("renders Chinese window controls and dispatches clicks", async () => {
    const user = userEvent.setup();
    const onMinimize = vi.fn();
    const onToggleMaximize = vi.fn();
    const onClose = vi.fn();

    render(
      <WindowControls
        onMinimize={onMinimize}
        onToggleMaximize={onToggleMaximize}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "最小化窗口" }));
    await user.click(screen.getByRole("button", { name: "最大化窗口" }));
    await user.click(screen.getByRole("button", { name: "关闭窗口" }));

    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onToggleMaximize).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run WindowControls test and verify RED**

Run:

```powershell
npm test -- src/app/components/WindowControls.test.tsx
```

Expected: FAIL because `WindowControls.tsx` does not exist.

- [ ] **Step 7: Create WindowControls component**

Create `src/app/components/WindowControls.tsx`:

```tsx
import { Minus, Square, X } from "lucide-react";

type Props = {
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
};

export function WindowControls({ onMinimize, onToggleMaximize, onClose }: Props) {
  return (
    <div className="window-controls" aria-label="窗口控制">
      <button className="window-control" type="button" aria-label="最小化窗口" title="最小化窗口" onClick={onMinimize}>
        <Minus aria-hidden="true" size={15} />
      </button>
      <button className="window-control" type="button" aria-label="最大化窗口" title="最大化窗口" onClick={onToggleMaximize}>
        <Square aria-hidden="true" size={15} />
      </button>
      <button className="window-control close" type="button" aria-label="关闭窗口" title="关闭窗口" onClick={onClose}>
        <X aria-hidden="true" size={15} />
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Run WindowControls test and verify GREEN**

Run:

```powershell
npm test -- src/app/components/WindowControls.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```powershell
git add src/app/backendBridge.ts src/app/backendBridge.test.ts src/app/components/WindowControls.tsx src/app/components/WindowControls.test.tsx
git commit -m "feat: 添加聊天区窗口控制组件"
```

---

### Task 3: Claude-Style Sidebar Without View-All

**Files:**
- Modify: `src/app/components/ClaudeSidebar.tsx`
- Modify: `src/app/components/ClaudeSidebar.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Replace sidebar tests with latest expected UI**

Replace `src/app/components/ClaudeSidebar.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClaudeSidebar } from "./ClaudeSidebar";

describe("ClaudeSidebar", () => {
  it("renders AI 测试助手 navigation and resumes recent sessions", async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();
    const onResumeSession = vi.fn();

    render(
      <ClaudeSidebar
        activeRunId="run-2"
        sessions={[
          { id: "run-1", title: "今天的咨询", tags: [] },
          { id: "run-2", title: "订单模块回归", tags: ["测试"] },
        ]}
        onNewChat={onNewChat}
        onResumeSession={onResumeSession}
      />,
    );

    expect(screen.getByText("AI 测试助手")).toBeInTheDocument();
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建聊天" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "对话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目" })).toBeInTheDocument();
    expect(screen.getByText("最近")).toBeInTheDocument();
    expect(screen.getByText("订单模块回归")).toBeInTheDocument();
    expect(screen.getByText("专业版")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看全部" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建聊天" }));
    await user.click(screen.getByRole("button", { name: "今天的咨询" }));

    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onResumeSession).toHaveBeenCalledWith("run-1");
  });

  it("shows a compact empty state when no recent sessions exist", () => {
    render(
      <ClaudeSidebar
        sessions={[]}
        onNewChat={vi.fn()}
        onResumeSession={vi.fn()}
      />,
    );

    expect(screen.getByText("暂无最近对话")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run sidebar test and verify RED**

Run:

```powershell
npm test -- src/app/components/ClaudeSidebar.test.tsx
```

Expected: FAIL because the component still renders `Claude`, accepts `onViewAll`, and shows `查看全部`.

- [ ] **Step 3: Implement sidebar UI**

Replace the prop type and component in `src/app/components/ClaudeSidebar.tsx` with:

```tsx
import { ChevronDown, Folder, MessageSquare, Plus, Sparkles } from "lucide-react";
import type { SessionSummary } from "../sdkUiTypes";

type Props = {
  activeRunId?: string;
  sessions: SessionSummary[];
  onNewChat: () => void;
  onResumeSession: (sessionId: string) => void;
};

export function ClaudeSidebar({ activeRunId, sessions, onNewChat, onResumeSession }: Props) {
  return (
    <aside className="claude-sidebar" aria-label="会话导航">
      <div className="claude-brand">
        <Sparkles aria-hidden="true" className="claude-brand-icon" size={23} />
        <span>AI 测试助手</span>
      </div>
      <nav className="claude-nav" aria-label="主导航">
        <button className="claude-nav-item" type="button" onClick={onNewChat}>
          <Plus aria-hidden="true" size={18} />
          新建聊天
        </button>
        <button className="claude-nav-item active" type="button">
          <MessageSquare aria-hidden="true" size={18} />
          对话
        </button>
        <button className="claude-nav-item" type="button">
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
      <div className="claude-profile">
        <span className="profile-avatar">测</span>
        <span className="profile-copy">
          <strong>测试人员</strong>
          <span>专业版</span>
        </span>
        <ChevronDown aria-hidden="true" size={16} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Update App props**

In `src/app/App.tsx`, remove `onViewAll={() => bridge.listSessions()}` from `ClaudeSidebar`.

- [ ] **Step 5: Run sidebar test and verify GREEN**

Run:

```powershell
npm test -- src/app/components/ClaudeSidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/app/components/ClaudeSidebar.tsx src/app/components/ClaudeSidebar.test.tsx src/app/App.tsx
git commit -m "feat: 更新侧栏为 AI 测试助手风格"
```

---

### Task 4: ConversationPane, Empty State, and Composer Copy

**Files:**
- Create: `src/app/components/EmptyConversationState.tsx`
- Create: `src/app/components/EmptyConversationState.test.tsx`
- Create: `src/app/components/ConversationPane.tsx`
- Create: `src/app/components/ConversationPane.test.tsx`
- Modify: `src/app/components/Composer.tsx`
- Modify: `src/app/components/Composer.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing empty state test**

Create `src/app/components/EmptyConversationState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyConversationState } from "./EmptyConversationState";

describe("EmptyConversationState", () => {
  it("renders compact Chinese guidance for ordinary chat", () => {
    render(<EmptyConversationState />);

    expect(screen.getByRole("heading", { name: "今天想测试什么？" })).toBeInTheDocument();
    expect(screen.getByText("可以直接提问，也可以描述一个业务流程，我会先帮你梳理风险和测试思路。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分析订单模块的关键测试风险" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "帮我设计登录流程的用例" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "解释接口回归测试怎么做" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run empty state test and verify RED**

Run:

```powershell
npm test -- src/app/components/EmptyConversationState.test.tsx
```

Expected: FAIL because the file does not exist.

- [ ] **Step 3: Create EmptyConversationState**

Create `src/app/components/EmptyConversationState.tsx`:

```tsx
import { Sparkles } from "lucide-react";

const suggestions = [
  "分析订单模块的关键测试风险",
  "帮我设计登录流程的用例",
  "解释接口回归测试怎么做",
];

export function EmptyConversationState() {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <Sparkles size={22} />
      </div>
      <h2>今天想测试什么？</h2>
      <p>可以直接提问，也可以描述一个业务流程，我会先帮你梳理风险和测试思路。</p>
      <div className="suggestions" aria-label="建议入口">
        {suggestions.map((suggestion) => (
          <button className="suggestion" key={suggestion} type="button">
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run empty state test and verify GREEN**

Run:

```powershell
npm test -- src/app/components/EmptyConversationState.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Replace Composer tests**

Replace `src/app/components/Composer.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("ignores blank input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="" onChange={vi.fn()} onSubmit={onSubmit} placeholder="向 AI 测试助手提问…" />);

    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders high-fidelity Chinese controls and submits trimmed text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="  测试订单模块  " onChange={vi.fn()} onSubmit={onSubmit} placeholder="补充测试指令或继续提问…" />);

    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "补充测试指令或继续提问…");
    expect(screen.queryByPlaceholderText("回复 Claude…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加内容" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
    expect(screen.getByText("Claude Sonnet 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith("测试订单模块");
  });
});
```

- [ ] **Step 6: Run Composer test and verify RED**

Run:

```powershell
npm test -- src/app/components/Composer.test.tsx
```

Expected: FAIL because `Composer` does not accept `placeholder` and still renders `回复 Claude…`.

- [ ] **Step 7: Update Composer**

Replace `Composer` props and textarea placeholder in `src/app/components/Composer.tsx`:

```tsx
type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder: string;
};
```

Use the prop in the component:

```tsx
export function Composer({ value, onChange, onSubmit, placeholder }: Props) {
```

Set the textarea placeholder:

```tsx
        placeholder={placeholder}
```

- [ ] **Step 8: Run Composer test and verify GREEN**

Run:

```powershell
npm test -- src/app/components/Composer.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Write failing ConversationPane test**

Create `src/app/components/ConversationPane.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInitialSdkUiState } from "../sdkEventStore";
import { ConversationPane } from "./ConversationPane";

const callbacks = {
  onApprove: vi.fn(),
  onDeny: vi.fn(),
  onAnswer: vi.fn(),
  onCopyMessage: vi.fn(),
  onRetryMessage: vi.fn(),
  onApprovePlan: vi.fn(),
  onComposerChange: vi.fn(),
  onComposerSubmit: vi.fn(),
  onMinimizeWindow: vi.fn(),
  onToggleMaximizeWindow: vi.fn(),
  onCloseWindow: vi.fn(),
};

describe("ConversationPane", () => {
  it("renders ordinary empty chat without title menu or execution state", () => {
    render(
      <ConversationPane
        state={createInitialSdkUiState()}
        title="新对话"
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
        onMinimizeWindow={callbacks.onMinimizeWindow}
        onToggleMaximizeWindow={callbacks.onToggleMaximizeWindow}
        onCloseWindow={callbacks.onCloseWindow}
      />,
    );

    expect(screen.getByRole("main", { name: "对话" })).toBeInTheDocument();
    expect(screen.getByText("新对话")).toBeInTheDocument();
    expect(screen.queryByLabelText("会话菜单")).not.toBeInTheDocument();
    expect(screen.queryByText("普通聊天")).not.toBeInTheDocument();
    expect(screen.queryByText("未进入测试执行")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "今天想测试什么？" })).toBeInTheDocument();
    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "向 AI 测试助手提问…");
    expect(screen.getByRole("button", { name: "最小化窗口" })).toBeInTheDocument();
  });

  it("renders test mode composer copy and confirm button", async () => {
    const user = userEvent.setup();
    const state = createInitialSdkUiState();
    state.activeRunId = "run-1";
    state.messages = [{ id: "msg-1", role: "assistant", content: "计划草稿", complete: true }];

    render(
      <ConversationPane
        state={state}
        title="订单模块回归"
        composerValue=""
        hasTestExecution={true}
        activeRunId="run-1"
        onApprove={callbacks.onApprove}
        onDeny={callbacks.onDeny}
        onAnswer={callbacks.onAnswer}
        onCopyMessage={callbacks.onCopyMessage}
        onRetryMessage={callbacks.onRetryMessage}
        onApprovePlan={callbacks.onApprovePlan}
        onComposerChange={callbacks.onComposerChange}
        onComposerSubmit={callbacks.onComposerSubmit}
        onMinimizeWindow={callbacks.onMinimizeWindow}
        onToggleMaximizeWindow={callbacks.onToggleMaximizeWindow}
        onCloseWindow={callbacks.onCloseWindow}
      />,
    );

    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "补充测试指令或继续提问…");
    await user.click(screen.getByRole("button", { name: "确认计划并执行" }));
    expect(callbacks.onApprovePlan).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 10: Run ConversationPane test and verify RED**

Run:

```powershell
npm test -- src/app/components/ConversationPane.test.tsx
```

Expected: FAIL because `ConversationPane.tsx` does not exist.

- [ ] **Step 11: Create ConversationPane**

Create `src/app/components/ConversationPane.tsx`:

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
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
  onCopyMessage: (content: string) => void;
  onRetryMessage: (messageId: string) => void;
  onApprovePlan: () => void;
  onComposerChange: (value: string) => void;
  onComposerSubmit: (value: string) => void;
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
  onApprove,
  onDeny,
  onAnswer,
  onCopyMessage,
  onRetryMessage,
  onApprovePlan,
  onComposerChange,
  onComposerSubmit,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
}: Props) {
  const isEmpty = state.messages.length === 0 && state.approvals.length === 0 && state.questions.length === 0;
  const placeholder = hasTestExecution ? "补充测试指令或继续提问…" : "向 AI 测试助手提问…";

  return (
    <main className="conversation" aria-label="对话">
      <header className="conversation-header">
        <span className="conversation-title">{title}</span>
        <WindowControls
          onMinimize={onMinimizeWindow}
          onToggleMaximize={onToggleMaximizeWindow}
          onClose={onCloseWindow}
        />
      </header>
      {isEmpty ? (
        <section className="message-stream" aria-label="消息流">
          <EmptyConversationState />
        </section>
      ) : (
        <MessageStream
          state={state}
          onApprove={onApprove}
          onDeny={onDeny}
          onAnswer={onAnswer}
          onCopyMessage={onCopyMessage}
          onRetryMessage={onRetryMessage}
        />
      )}
      {activeRunId ? (
        <div className="plan-action-row">
          <button className="primary-action" type="button" onClick={onApprovePlan}>
            确认计划并执行
          </button>
        </div>
      ) : null}
      <Composer value={composerValue} onChange={onComposerChange} onSubmit={onComposerSubmit} placeholder={placeholder} />
    </main>
  );
}
```

- [ ] **Step 12: Run ConversationPane test and verify GREEN**

Run:

```powershell
npm test -- src/app/components/ConversationPane.test.tsx
```

Expected: PASS.

- [ ] **Step 13: Wire ConversationPane into App**

In `src/app/App.tsx`, remove direct imports of `Composer` and `MessageStream`, add:

```ts
import { ConversationPane } from "./components/ConversationPane";
```

Replace the direct conversation main block in `src/app/App.tsx` that starts with `<main className="conversation"` and ends immediately before the conditional `TestConsole` rendering with:

```tsx
      <ConversationPane
        state={state}
        title={activeRunId ?? "新对话"}
        composerValue={composerValue}
        hasTestExecution={shouldShowTestConsole}
        activeRunId={activeRunId}
        onApprove={bridge.approveTool}
        onDeny={bridge.denyTool}
        onAnswer={bridge.answerQuestion}
        onCopyMessage={(content) => { navigator.clipboard?.writeText(content); }}
        onRetryMessage={(messageId) => { bridge.sendMessage(activeRunId ?? "", messageId); }}
        onApprovePlan={handleApprovePlan}
        onComposerChange={setComposerValue}
        onComposerSubmit={handleComposerSubmit}
        onMinimizeWindow={bridge.minimizeWindow}
        onToggleMaximizeWindow={bridge.toggleMaximizeWindow}
        onCloseWindow={bridge.closeWindow}
      />
```

- [ ] **Step 14: Run affected component tests and verify GREEN**

Run:

```powershell
npm test -- src/app/components/EmptyConversationState.test.tsx src/app/components/Composer.test.tsx src/app/components/ConversationPane.test.tsx src/app/App.test.tsx
```

Expected: PASS after updating App test expectations in Task 8 if this step reveals old copy assertions.

- [ ] **Step 15: Commit Task 4**

```powershell
git add src/app/App.tsx src/app/components/EmptyConversationState.tsx src/app/components/EmptyConversationState.test.tsx src/app/components/ConversationPane.tsx src/app/components/ConversationPane.test.tsx src/app/components/Composer.tsx src/app/components/Composer.test.tsx
git commit -m "feat: 重组聊天主界面和输入区"
```

---

### Task 5: MessageStream and Claude Code Style Review Card

**Files:**
- Modify: `src/app/components/MessageStream.tsx`
- Modify: `src/app/components/MessageStream.test.tsx`
- Modify: `src/app/components/ToolApprovalCard.tsx`
- Modify: `src/app/components/ToolApprovalCard.test.tsx`

- [ ] **Step 1: Replace ToolApprovalCard tests**

Replace `src/app/components/ToolApprovalCard.test.tsx` with:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolApprovalCard } from "./ToolApprovalCard";

const request = {
  runId: "run-1",
  requestId: "approval-1",
  toolCall: {
    id: "approval-1",
    toolName: "browser.navigate",
    label: "浏览器工具",
    status: "waiting_approval" as const,
    inputSummary: "目标：/orders?status=pending_payment\n操作：读取页面状态，不修改业务数据",
    approvalReason: "打开订单列表页，并检查“待支付”状态筛选是否正确。",
  },
};

describe("ToolApprovalCard", () => {
  it("renders Claude Code style review content and toggles details", async () => {
    const user = userEvent.setup();

    render(<ToolApprovalCard request={request} onApprove={vi.fn()} onDeny={vi.fn()} />);

    expect(screen.getByRole("region", { name: "需要审核工具调用" })).toBeInTheDocument();
    expect(screen.getByText("AI 测试助手想使用浏览器工具")).toBeInTheDocument();
    expect(screen.getByText("需要你审核后才能继续执行")).toBeInTheDocument();
    expect(screen.getByText("等待审核")).toBeInTheDocument();
    expect(screen.getByText("打开订单列表页，并检查“待支付”状态筛选是否正确。")).toBeInTheDocument();
    expect(screen.getByText(/工具：browser.navigate/)).toBeInTheDocument();
    expect(screen.getByText("影响范围：会访问当前测试环境页面，并把结果写入本次会话证据。")).toBeInTheDocument();

    expect(screen.queryByLabelText("原始工具输入")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看详情" }));
    expect(screen.getByLabelText("原始工具输入")).toHaveTextContent("browser.navigate");
    await user.click(screen.getByRole("button", { name: "收起详情" }));
    expect(screen.queryByLabelText("原始工具输入")).not.toBeInTheDocument();
  });

  it("submits allow once, allow for session, and deny decisions", async () => {
    const user = userEvent.setup();
    const approve = vi.fn();
    const deny = vi.fn();

    render(<ToolApprovalCard request={request} onApprove={approve} onDeny={deny} />);

    await user.click(screen.getByRole("button", { name: "允许一次" }));
    expect(approve).toHaveBeenCalledWith("run-1", "approval-1", {
      updatedInput: undefined,
      applyPermissionSuggestions: false,
    });
    expect(screen.getByText("已允许一次")).toBeInTheDocument();

    render(<ToolApprovalCard request={request} onApprove={approve} onDeny={deny} />);
    await user.click(screen.getAllByRole("button", { name: "本会话允许" }).at(-1)!);
    expect(approve).toHaveBeenCalledWith("run-1", "approval-1", {
      updatedInput: undefined,
      applyPermissionSuggestions: true,
    });

    render(<ToolApprovalCard request={request} onApprove={approve} onDeny={deny} />);
    fireEvent.change(screen.getAllByLabelText("拒绝原因").at(-1)!, { target: { value: "当前环境不允许访问订单页面" } });
    await user.click(screen.getAllByRole("button", { name: "拒绝" }).at(-1)!);
    expect(deny).toHaveBeenCalledWith("run-1", "approval-1", "当前环境不允许访问订单页面");
  });
});
```

- [ ] **Step 2: Run ToolApprovalCard test and verify RED**

Run:

```powershell
npm test -- src/app/components/ToolApprovalCard.test.tsx
```

Expected: FAIL because the current card renders `工具授权` behavior with JSON editing and no Claude Code style review structure.

- [ ] **Step 3: Replace ToolApprovalCard implementation**

Replace `src/app/components/ToolApprovalCard.tsx` with:

```tsx
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { ApprovalRequest } from "../sdkUiTypes";

type Props = {
  request: ApprovalRequest;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
};

function inputSummary(request: ApprovalRequest) {
  const summary = request.toolCall.inputSummary?.trim();
  if (summary) {
    return `工具：${request.toolCall.toolName}\n${summary}`;
  }
  return `工具：${request.toolCall.toolName}\n操作：等待工具输入摘要`;
}

function approvalReason(request: ApprovalRequest) {
  return request.toolCall.approvalReason?.trim() || `${request.toolCall.label} 请求执行工具调用。`;
}

export function ToolApprovalCard({ request, onApprove, onDeny }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [decision, setDecision] = useState<"pending" | "allow-once" | "allow-session" | "denied">("pending");
  const disabled = decision !== "pending";

  function approve(applyPermissionSuggestions: boolean) {
    onApprove(request.runId, request.requestId, {
      updatedInput: undefined,
      applyPermissionSuggestions,
    });
    setDecision(applyPermissionSuggestions ? "allow-session" : "allow-once");
  }

  function deny() {
    const message = denyReason.trim() || "用户拒绝了此次工具调用";
    onDeny(request.runId, request.requestId, message);
    setDecision("denied");
  }

  const statusLabel = decision === "allow-once"
    ? "已允许一次"
    : decision === "allow-session"
      ? "已在本会话允许"
      : decision === "denied"
        ? "已拒绝"
        : "等待审核";

  return (
    <section className={disabled ? "message review-card completed" : "message review-card"} aria-label="需要审核工具调用">
      <div className="review-head">
        <div className="review-icon" aria-hidden="true">
          <ShieldCheck size={17} />
        </div>
        <div className="review-copy">
          <strong>AI 测试助手想使用{request.toolCall.label}</strong>
          <span>需要你审核后才能继续执行</span>
        </div>
        <span className="review-status">{statusLabel}</span>
      </div>
      <p className="review-summary">{approvalReason(request)}</p>
      <pre className="review-code">{inputSummary(request)}</pre>
      <p className="review-impact">影响范围：会访问当前测试环境页面，并把结果写入本次会话证据。</p>
      <button className="review-detail" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "收起详情" : "查看详情"}
        {expanded ? <ChevronUp aria-hidden="true" size={13} /> : <ChevronDown aria-hidden="true" size={13} />}
      </button>
      {expanded ? (
        <pre className="review-code" aria-label="原始工具输入">{JSON.stringify(request.toolCall, null, 2)}</pre>
      ) : null}
      <label className="deny-reason">
        拒绝原因
        <input value={denyReason} onChange={(event) => setDenyReason(event.currentTarget.value)} disabled={disabled} />
      </label>
      <div className="review-actions">
        <button className="review-button primary" type="button" onClick={() => approve(false)} disabled={disabled}>允许一次</button>
        <button className="review-button session" type="button" onClick={() => approve(true)} disabled={disabled}>本会话允许</button>
        <button className="review-button deny" type="button" onClick={deny} disabled={disabled}>拒绝</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run ToolApprovalCard test and verify GREEN**

Run:

```powershell
npm test -- src/app/components/ToolApprovalCard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Replace MessageStream tests**

Replace `src/app/components/MessageStream.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageStream } from "./MessageStream";

describe("MessageStream", () => {
  it("renders messages in one narrow column without SDK debug details or reaction controls", () => {
    render(<MessageStream state={{
      activeRunId: "run-1",
      workspaceModes: {},
      messages: [
        { id: "msg-user", role: "user", content: "帮我分析订单风险", complete: true },
        { id: "msg-1", role: "assistant", content: "正在生成计划", complete: false },
      ],
      approvals: [{
        runId: "run-1",
        requestId: "approval-1",
        toolCall: {
          id: "approval-1",
          toolName: "browser.navigate",
          label: "浏览器工具",
          status: "waiting_approval",
          inputSummary: "目标：/orders",
          approvalReason: "打开订单列表页。",
        },
      }],
      questions: [{ runId: "run-1", requestId: "question-1", questions: [{ id: "scope", label: "测试范围" }] }],
      mcpServers: [{ name: "browser", status: "connected" }],
      evidence: [],
      rawMessages: [{ type: "system", subtype: "compact_boundary" }],
      usage: { input_tokens: 10 },
      errors: [{ message: "网关认证失败", retryable: true }],
      tasks: [{ taskId: "task-1", summary: "正在执行子任务" }],
      sessions: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} onCopyMessage={vi.fn()} onRetryMessage={vi.fn()} />);

    const stream = screen.getByRole("region", { name: "消息流" });
    expect(stream.querySelector(".message-column")).toBeInTheDocument();

    const userMessage = screen.getByText("帮我分析订单风险").closest(".user-bubble");
    expect(userMessage).toBeInTheDocument();
    expect(within(userMessage as HTMLElement).getByText("测")).toBeInTheDocument();

    expect(screen.getByText("正在生成计划")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "复制回复" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "重试回复" })).toHaveLength(1);
    expect(screen.getByText("AI 测试助手想使用浏览器工具")).toBeInTheDocument();
    expect(screen.getByText("需要补充信息")).toBeInTheDocument();
    expect(screen.queryByText("SDK Usage")).not.toBeInTheDocument();
    expect(screen.queryByText(/SDK Raw Message/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("收藏回复")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("赞同回复")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("反对回复")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run MessageStream test and verify RED**

Run:

```powershell
npm test -- src/app/components/MessageStream.test.tsx
```

Expected: FAIL because current user avatar is not inside `.user-bubble`, there is no `.message-column`, and raw SDK details are rendered.

- [ ] **Step 7: Update MessageStream**

Replace the return body in `src/app/components/MessageStream.tsx` with:

```tsx
  return (
    <section className="message-stream" aria-label="消息流">
      <div className="message-column">
        {state.messages.map((message) => (
          <article className={`message ${message.role}-message`} key={message.id}>
            {message.role === "assistant" ? (
              <>
                <Sparkles aria-hidden="true" className="assistant-mark" size={22} />
                <div>
                  <p>{message.content}</p>
                  <div className="assistant-actions">
                    <button aria-label="复制回复" type="button" onClick={() => onCopyMessage(message.content)}><Copy aria-hidden="true" size={14} />复制</button>
                    <button aria-label="重试回复" type="button" onClick={() => onRetryMessage(message.id)}><RefreshCcw aria-hidden="true" size={14} />重试</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="user-bubble">
                <span className="profile-avatar">测</span>
                <span>{message.content}</span>
              </div>
            )}
          </article>
        ))}
        {state.approvals.map((request) => (
          <ToolApprovalCard key={request.requestId} request={request} onApprove={onApprove} onDeny={onDeny} />
        ))}
        {state.questions.map((request) => (
          <AskUserQuestionCard key={request.requestId} request={request} onAnswer={onAnswer} />
        ))}
        {state.errors.map((error, index) => <p className="sdk-error" key={`${error.message}-${index}`}>{error.message}</p>)}
        {state.tasks.map((task) => <p className="sdk-task" key={task.taskId}>{task.summary ?? task.taskId}</p>)}
      </div>
    </section>
  );
```

- [ ] **Step 8: Run MessageStream test and verify GREEN**

Run:

```powershell
npm test -- src/app/components/MessageStream.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```powershell
git add src/app/components/MessageStream.tsx src/app/components/MessageStream.test.tsx src/app/components/ToolApprovalCard.tsx src/app/components/ToolApprovalCard.test.tsx
git commit -m "feat: 添加 Claude Code 风格审核卡"
```

---

### Task 6: Test Console High-Fidelity Content

**Files:**
- Modify: `src/app/components/TestConsole.tsx`
- Modify: `src/app/components/TestConsole.test.tsx`

- [ ] **Step 1: Replace TestConsole tests**

Replace `src/app/components/TestConsole.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestConsole } from "./TestConsole";

describe("TestConsole", () => {
  it("renders high-fidelity Chinese monitor content and controls", async () => {
    const user = userEvent.setup();
    const onApprovePlan = vi.fn();
    const onStopTask = vi.fn();

    render(
      <TestConsole
        activeTaskId="task-3"
        mcpServers={[
          { name: "browser", status: "connected" },
          { name: "api", status: "failed" },
          { name: "auth", status: "needs-auth" },
        ]}
        tasks={[
          { taskId: "task-1", summary: "打开订单列表" },
          { taskId: "task-2", summary: "筛选待支付订单" },
          { taskId: "task-3", summary: "执行订单状态检查" },
        ]}
        evidence={[
          { id: "evidence-1", type: "screenshot", title: "订单截图", summary: "订单状态显示异常" },
          { id: "evidence-2", type: "log", title: "接口日志", summary: "重复回调" },
        ]}
        bugDraft={{
          title: "支付回调重复通知导致状态异常",
          severity: "P1",
          steps: ["创建订单", "重复回调"],
          expected: "订单保持已支付",
          actual: "订单状态回退",
          evidenceIds: ["evidence-1"],
        }}
        onApprovePlan={onApprovePlan}
        onStopTask={onStopTask}
      />,
    );

    expect(screen.getByRole("complementary", { name: "测试监控台" })).toBeInTheDocument();
    expect(screen.getByText("计划进度")).toBeInTheDocument();
    expect(screen.getByText("3 / 5 个场景 · 执行订单状态检查")).toBeInTheDocument();
    expect(screen.getByLabelText("测试进度").querySelector("span")).toHaveStyle({ width: "60%" });
    expect(screen.getByText("浏览器")).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();
    expect(screen.getByText("接口")).toBeInTheDocument();
    expect(screen.getByText("连接失败")).toBeInTheDocument();
    expect(screen.getByText("需要授权")).toBeInTheDocument();
    expect(screen.getByText("认证")).toBeInTheDocument();
    expect(screen.getByText("截图 1 张 · 日志 1 条")).toBeInTheDocument();
    expect(screen.getByText("支付回调重复通知导致状态异常")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认执行" }));
    await user.click(screen.getByRole("button", { name: "停止" }));

    expect(onApprovePlan).toHaveBeenCalledTimes(1);
    expect(onStopTask).toHaveBeenCalledWith("task-3");
  });
});
```

- [ ] **Step 2: Run TestConsole test and verify RED**

Run:

```powershell
npm test -- src/app/components/TestConsole.test.tsx
```

Expected: FAIL because current console lacks progress bar, compact count text, and evidence type summary.

- [ ] **Step 3: Implement high-fidelity TestConsole**

Replace `TestConsole` helper logic and progress section with:

```tsx
function evidenceSummary(evidence: Evidence[]) {
  const screenshots = evidence.filter((item) => item.type === "screenshot").length;
  const logs = evidence.filter((item) => item.type === "log").length;
  return `截图 ${screenshots} 张 · 日志 ${logs} 条`;
}

function progress(tasks: SdkTaskProgress[]) {
  const current = Math.min(tasks.length, 5);
  return {
    text: `${current} / 5 个场景 · ${tasks.at(-1)?.summary ?? "等待执行测试计划"}`,
    width: `${current * 20}%`,
  };
}
```

Inside component:

```tsx
  const currentProgress = progress(tasks);
```

Replace the plan progress card with:

```tsx
        <section className="monitor-card">
          <h3>计划进度</h3>
          <div className="progress" aria-label="测试进度">
            <span style={{ width: currentProgress.width }} />
          </div>
          <p>{currentProgress.text}</p>
        </section>
```

Replace evidence text:

```tsx
          <p>{evidenceSummary(evidence)}</p>
```

- [ ] **Step 4: Run TestConsole test and verify GREEN**

Run:

```powershell
npm test -- src/app/components/TestConsole.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add src/app/components/TestConsole.tsx src/app/components/TestConsole.test.tsx
git commit -m "feat: 高保真测试监控台"
```

---

### Task 7: Apply High-Fidelity CSS

**Files:**
- Modify: `src/ui/styles.css`
- Create: `tests/e2e/claude-desktop-ui-redesign.spec.ts`

- [ ] **Step 1: Write failing Playwright layout/CSS test**

Create `tests/e2e/claude-desktop-ui-redesign.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("ordinary chat uses high-fidelity Claude Desktop shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("AI 测试助手")).toBeVisible();
  await expect(page.getByText("Claude", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看全部" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "今天想测试什么？" })).toBeVisible();
  await expect(page.getByLabel("消息输入")).toHaveAttribute("placeholder", "向 AI 测试助手提问…");
  await expect(page.getByRole("button", { name: "最小化窗口" })).toBeVisible();

  await expect(page.locator(".claude-sidebar")).toHaveCSS("background-color", "rgb(244, 239, 231)");
  await expect(page.locator(".app-shell")).toHaveCSS("background-color", "rgb(253, 251, 247)");
  await expect(page.locator(".composer-shell")).toHaveCSS("border-radius", "12px");
});

test("test execution keeps messages and review card in one narrow column", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("消息输入").fill("测试订单模块功能");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "确认计划并执行" }).click();

  await expect(page.getByRole("complementary", { name: "测试监控台" })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认执行" })).toBeVisible();

  const messageColumn = page.locator(".message-column").first();
  await expect(messageColumn).toBeVisible();
  const box = await messageColumn.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(620);

  await expect(page.locator(".window-controls").first()).toBeVisible();
});
```

- [ ] **Step 2: Run E2E test and verify RED**

Run:

```powershell
npm run e2e -- tests/e2e/claude-desktop-ui-redesign.spec.ts
```

Expected: FAIL until the new components and CSS are wired in. If the Vite dev server is not already running, Playwright config should start it; if it does not, run `npm run dev` in a separate terminal and rerun.

- [ ] **Step 3: Replace styles.css with the CSS contract**

Replace the entire contents of `src/ui/styles.css` with the CSS in the `High-Fidelity CSS Contract` section of this plan.

- [ ] **Step 4: Run component and E2E tests and verify GREEN**

Run:

```powershell
npm test -- src/app/components/ClaudeSidebar.test.tsx src/app/components/ConversationPane.test.tsx src/app/components/MessageStream.test.tsx src/app/components/ToolApprovalCard.test.tsx src/app/components/Composer.test.tsx src/app/components/TestConsole.test.tsx
npm run e2e -- tests/e2e/claude-desktop-ui-redesign.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```powershell
git add src/ui/styles.css tests/e2e/claude-desktop-ui-redesign.spec.ts
git commit -m "style: 应用 Claude Desktop 高保真样式"
```

---

### Task 8: App Integration and Existing Test Updates

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `tests/e2e/ai-test-flow.spec.ts`

- [ ] **Step 1: Replace App integration tests with final UI expectations**

Update assertions in `src/app/App.test.tsx`:

```tsx
expect(screen.getByText("AI 测试助手")).toBeInTheDocument();
expect(screen.queryByText("Claude", { exact: true })).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: "查看全部" })).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "最小化窗口" })).toBeInTheDocument();
expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "向 AI 测试助手提问…");
```

For the backend integration test that emits a tool approval, update the approval assertion:

```tsx
expect(screen.getByText("AI 测试助手想使用查询订单数据库")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "允许一次" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "本会话允许" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "拒绝" })).toBeInTheDocument();
```

For the IPC decision test, replace the click target:

```tsx
await user.click(screen.getByRole("button", { name: "允许一次" }));
```

Keep this send expectation:

```tsx
expect(send).toHaveBeenCalledWith("tool:approve", expect.objectContaining({
  runId: "run-1",
  requestId: "approval-1",
  applyPermissionSuggestions: false,
}));
```

- [ ] **Step 2: Run App test and verify RED or GREEN**

Run:

```powershell
npm test -- src/app/App.test.tsx
```

Expected: PASS if previous tasks were completed correctly; otherwise FAIL identifying the remaining integration mismatch.

- [ ] **Step 3: Update existing E2E flow expectations**

In `tests/e2e/ai-test-flow.spec.ts`, add high-fidelity assertions to the first test:

```ts
await expect(page.getByText("AI 测试助手")).toBeVisible();
await expect(page.getByText("Claude", { exact: true })).toHaveCount(0);
await expect(page.getByRole("button", { name: "查看全部" })).toHaveCount(0);
await expect(page.getByRole("button", { name: "最小化窗口" })).toBeVisible();
```

In the execution tests, add:

```ts
await expect(page.getByRole("complementary", { name: "测试监控台" })).toBeVisible();
await expect(page.getByText("计划进度")).toBeVisible();
await expect(page.getByText("MCP 服务")).toBeVisible();
```

- [ ] **Step 4: Run existing E2E tests**

Run:

```powershell
npm run e2e -- tests/e2e/ai-test-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 8**

```powershell
git add src/app/App.test.tsx tests/e2e/ai-test-flow.spec.ts
git commit -m "test: 更新高保真 UI 集成断言"
```

---

### Task 9: Full Verification

**Files:**
- No source changes expected in this task.

- [ ] **Step 1: Run all unit/component tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 2: Run all E2E tests**

Run:

```powershell
npm run e2e
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS with TypeScript and Vite build completing.

- [ ] **Step 4: Run visual smoke in browser**

Run:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173` and verify:

- 普通新会话显示“今天想测试什么？”空态。
- 左侧品牌是“AI 测试助手”。
- 左侧没有“查看全部”。
- 顶部没有系统菜单栏式内容。
- 窗口按钮在聊天区右上角。
- 输入框 placeholder 是中文。
- 触发测试执行后才出现“测试监控台”。
- 工具审核卡显示“允许一次”“本会话允许”“拒绝”。

- [ ] **Step 5: Commit verification notes if tests caused snapshot/report file changes**

Only stage generated report files if they are intentionally tracked by the repo. Otherwise leave them untracked or ignored.

```powershell
git status --short
```

Expected: only intended source/test/CSS files are modified after implementation commits.

---

## Self-Review

**Spec coverage:**

- 普通聊天无右侧栏：Task 4、Task 7、Task 8.
- 测试执行后显示右侧栏：Task 6、Task 8.
- 历史/事件触发测试模式：已有 `sdkEventStore` 覆盖，Task 8 保留集成测试。
- 隐藏 Electron 默认菜单栏：Task 1.
- 窗口按钮在聊天区右上角：Task 1、Task 2、Task 4、Task 7.
- 品牌统一为“AI 测试助手”：Task 3、Task 8.
- 删除“查看全部”：Task 3、Task 8.
- 删除会话标题下拉箭头：Task 4、Task 8.
- 中文 placeholder 和中文界面：Task 4、Task 8.
- 用户头像在气泡内、消息列窄列：Task 5、Task 7.
- Claude Code 风格审核卡：Task 5.
- CSS 高保真值：Task 7 的 CSS 合同覆盖所有 UI 元素。

**Placeholder scan:** 禁用占位符短语扫描通过，计划内容没有未展开步骤。

**Type consistency:**

- `WindowControls` 回调名与 `ConversationPane` props 一致。
- `BackendBridge` 方法名与 `App.tsx` 使用一致。
- `ToolApprovalCard` 保持现有 `onApprove` / `onDeny` 签名，不改后端协议。
- `Composer` 新增 `placeholder` prop，并由 `ConversationPane` 统一传入。
