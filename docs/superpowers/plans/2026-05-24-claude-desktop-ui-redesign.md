# Claude Desktop UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-05-24-claude-desktop-ui-redesign-design.md` 将前端改造成 Claude Desktop 风格双模式工作区，并严格保证测试执行后才显示右侧“测试监控台”。

**Architecture:** 先在 `sdkEventStore` 中建立会话级 `workspaceModes` 状态，保证 UI 模式由 reducer 可测试地驱动。再拆出 `ClaudeSidebar`、`Composer`、`TestConsole` 等 focused components，最后用 `App` 组合普通聊天两栏布局和测试执行三栏布局。

**Tech Stack:** Electron, Vite, React 19, TypeScript, Vitest, React Testing Library, Playwright, lucide-react, CSS.

---

## Scope Check

这份 spec 只覆盖前端信息架构、视觉和交互结构，不改变后端 Agent、MCP 协议或 IPC 通道语义。可以作为一个计划实现，不需要拆成多个独立项目。

## TDD Rules For This Plan

- 每个任务先写测试，再运行并确认失败，再写最少生产代码，再运行并确认通过。
- 如果新测试第一次运行就通过，说明测试没有约束新行为，必须改测试后重新执行 RED。
- 如果测试因为语法错误、导入错误或测试写错而失败，先修测试，直到它因缺少目标行为而失败。
- 每个任务结束时运行该任务相关测试；最后运行 `npm test` 和 `npm run build`。
- 生产代码步骤只能实现当前测试覆盖的行为，不做顺手重构。

## File Structure

- Modify: `src/app/sdkUiTypes.ts`
  - 新增 `workspaceModes`、`evidence`、`bugDraft` 等 UI 状态字段。
  - 允许 reducer 接收本地 UI 事件 `ui:test-execution-confirmed`。
- Modify: `src/app/sdkEventStore.ts`
  - 为测试执行证据事件设置 `hasTestExecution`。
  - 收集 MCP、证据、缺陷草稿和任务进度供测试监控台使用。
- Modify: `src/app/sdkEventStore.test.ts`
  - 覆盖普通聊天事件不触发测试模式、确认执行触发、工具/证据/缺陷事件兜底触发、多 run 隔离。
- Create: `src/app/components/ClaudeSidebar.tsx`
  - Claude Desktop 风格左侧导航。
- Create: `src/app/components/ClaudeSidebar.test.tsx`
  - 验证中文导航、最近会话、用户区和会话恢复操作。
- Create: `src/app/components/Composer.tsx`
  - 底部悬浮输入框，统一首条消息和补充消息提交体验。
- Create: `src/app/components/Composer.test.tsx`
  - 验证中文 placeholder、空输入不提交、发送按钮和图标按钮可访问。
- Modify: `src/app/components/ToolApprovalCard.tsx`
  - 视觉和文案改为 Claude 风格内联工具授权卡。
- Modify: `src/app/components/ToolApprovalCard.test.tsx`
  - 更新按钮文案为“允许”“拒绝”，保留 JSON 输入与权限建议行为。
- Modify: `src/app/components/AskUserQuestionCard.tsx`
  - 保持聊天流内联，中文化 `aria-label` 和按钮。
- Modify: `src/app/components/AskUserQuestionCard.test.tsx`
  - 确认澄清问题仍在聊天流提交答案。
- Modify: `src/app/components/MessageStream.tsx`
  - 渲染 Claude 风格用户/助手消息，助手回复仅有“复制”“重试”操作。
  - 不再渲染 MCP 状态列表；MCP 信息迁移到 `TestConsole`。
- Modify: `src/app/components/MessageStream.test.tsx`
  - 验证中文消息流、工具授权、问题卡、错误和任务；验证不出现收藏/点赞/点踩。
- Create: `src/app/components/TestConsole.tsx`
  - 右侧“测试监控台”，展示计划进度、MCP 服务、证据、缺陷草稿和控制按钮。
- Create: `src/app/components/TestConsole.test.tsx`
  - 验证中文状态、证据计数、缺陷摘要和停止/确认执行按钮。
- Modify: `src/app/App.tsx`
  - 组合 `ClaudeSidebar`、`MessageStream`、`Composer`、`TestConsole`。
  - 点击“确认计划并执行”先 dispatch `ui:test-execution-confirmed`，再调用 `bridge.approvePlan`。
- Modify: `src/app/App.test.tsx`
  - 验证普通聊天不显示测试监控台、确认执行后显示、测试证据事件兜底显示、非触发事件不显示。
- Modify: `src/ui/styles.css`
  - 实现 Claude Desktop 风格布局、颜色、消息列、悬浮输入框、右侧监控台。
- Modify: `tests/e2e/ai-test-flow.spec.ts`
  - 更新 E2E 到新中文界面和双模式工作区。

---

### Task 1: 会话级测试执行模式状态

**Files:**
- Modify: `src/app/sdkUiTypes.ts`
- Modify: `src/app/sdkEventStore.ts`
- Test: `src/app/sdkEventStore.test.ts`

- [ ] **Step 1: Write the failing reducer tests**

Append these tests inside `describe("sdkEventStore", () => { ... })` in `src/app/sdkEventStore.test.ts`:

```ts
  it("keeps ordinary chat and plan events out of test execution mode", () => {
    let state = createInitialSdkUiState();

    state = reduceSdkUiEvent(state, {
      channel: "assistant:text-delta",
      payload: { runId: "chat-run", messageId: "msg-1", delta: "普通咨询回复" },
    });
    state = reduceSdkUiEvent(state, {
      channel: "run:plan-ready",
      payload: {
        runId: "chat-run",
        plan: [{ id: "step-1", title: "分析风险", status: "pending" }],
      },
    });
    state = reduceSdkUiEvent(state, {
      channel: "question:required",
      payload: { runId: "chat-run", requestId: "question-1", questions: [{ id: "scope", label: "范围" }] },
    });

    expect(state.workspaceModes).toEqual({});
  });

  it("marks only the active run as test execution after local confirmation", () => {
    let state = createInitialSdkUiState();

    state = reduceSdkUiEvent(state, {
      channel: "ui:test-execution-confirmed",
      payload: { runId: "run-1" },
    });

    expect(state.workspaceModes).toEqual({
      "run-1": { hasTestExecution: true },
    });
  });

  it("marks test execution from backend execution evidence while keeping runs isolated", () => {
    let state = createInitialSdkUiState();

    state = reduceSdkUiEvent(state, {
      channel: "tool:approval-required",
      payload: {
        runId: "run-1",
        requestId: "approval-1",
        toolCall: { id: "approval-1", toolName: "browser.open", label: "打开订单列表", status: "waiting_approval" },
      },
    });
    state = reduceSdkUiEvent(state, {
      channel: "evidence:created",
      payload: {
        runId: "run-2",
        evidence: { id: "evidence-1", type: "screenshot", title: "订单列表截图", summary: "存在待支付订单" },
      },
    });
    state = reduceSdkUiEvent(state, {
      channel: "bug-draft:created",
      payload: {
        runId: "run-2",
        bugDraft: {
          title: "支付回调重复通知导致状态异常",
          severity: "P1",
          steps: ["创建订单", "重复发送支付回调"],
          expected: "订单保持已支付",
          actual: "订单状态回退",
          evidenceIds: ["evidence-1"],
        },
      },
    });

    expect(state.workspaceModes).toEqual({
      "run-1": { hasTestExecution: true },
      "run-2": { hasTestExecution: true },
    });
    expect(state.evidence).toHaveLength(1);
    expect(state.bugDraft?.title).toBe("支付回调重复通知导致状态异常");
  });
```

- [ ] **Step 2: Run reducer tests to verify RED**

Run:

```powershell
npm test -- src/app/sdkEventStore.test.ts
```

Expected: FAIL. The failure should mention `workspaceModes` does not exist on `SdkUiState` or `ui:test-execution-confirmed` is not assignable. If it passes, stop and strengthen the tests.

- [ ] **Step 3: Add state types**

In `src/app/sdkUiTypes.ts`, add imports and types:

```ts
import type { BugDraft, Evidence } from "../domain/testRun";
```

Add below `SdkTaskProgress`:

```ts
export type SessionWorkspaceMode = {
  hasTestExecution: boolean;
};

export type LocalUiEvent = {
  channel: "ui:test-execution-confirmed";
  payload: { runId: string };
};
```

Update `SdkUiState`:

```ts
export type SdkUiState = {
  activeRunId?: string;
  workspaceModes: Record<string, SessionWorkspaceMode>;
  messages: SdkMessage[];
  approvals: ApprovalRequest[];
  questions: QuestionRequest[];
  mcpServers: McpServerUiStatus[];
  evidence: Evidence[];
  bugDraft?: BugDraft;
  rawMessages: unknown[];
  usage?: unknown;
  errors: Array<{ message: string; retryable: boolean }>;
  tasks: SdkTaskProgress[];
  sessions: SessionSummary[];
};
```

Update `SdkUiEvent`:

```ts
export type SdkUiEvent = {
  channel: MainToRendererChannel;
  payload: unknown;
} | LocalUiEvent;
```

- [ ] **Step 4: Implement minimal reducer support**

In `src/app/sdkEventStore.ts`, update imports:

```ts
import type { ApprovalRequest, McpServerUiStatus, QuestionRequest, SdkUiEvent, SdkUiState } from "./sdkUiTypes";
import type { BugDraft, Evidence } from "../domain/testRun";
```

Add helpers near `runIdFrom`:

```ts
const testExecutionChannels = new Set<SdkUiEvent["channel"]>([
  "tool:call-started",
  "tool:approval-required",
  "tool:call-completed",
  "tool:call-failed",
  "evidence:created",
  "bug-draft:created",
  "sdk:task-progress",
  "sdk:mcp-status",
  "ui:test-execution-confirmed",
]);

function markHasTestExecution(state: SdkUiState, runId: string | undefined): SdkUiState {
  if (!runId) return state;
  return {
    ...state,
    workspaceModes: {
      ...state.workspaceModes,
      [runId]: { hasTestExecution: true },
    },
  };
}
```

Update `createInitialSdkUiState`:

```ts
export function createInitialSdkUiState(): SdkUiState {
  return {
    workspaceModes: {},
    messages: [],
    approvals: [],
    questions: [],
    mcpServers: [],
    evidence: [],
    rawMessages: [],
    errors: [],
    tasks: [],
    sessions: [],
  };
}
```

At the top of `reduceSdkUiEvent`, after `activeRunId`:

```ts
  if (event.channel === "ui:test-execution-confirmed") {
    return markHasTestExecution({ ...state, activeRunId }, activeRunId);
  }
```

For `tool:approval-required`, wrap the return:

```ts
    return markHasTestExecution({ ...state, activeRunId, approvals }, activeRunId);
```

Add event handlers before the final return:

```ts
  if (event.channel === "tool:call-started" || event.channel === "tool:call-completed" || event.channel === "tool:call-failed") {
    return markHasTestExecution({ ...state, activeRunId }, activeRunId);
  }

  if (event.channel === "evidence:created") {
    const evidence = payload.evidence as Evidence;
    return markHasTestExecution({ ...state, activeRunId, evidence: evidence ? [...state.evidence, evidence] : state.evidence }, activeRunId);
  }

  if (event.channel === "bug-draft:created") {
    return markHasTestExecution({ ...state, activeRunId, bugDraft: payload.bugDraft as BugDraft }, activeRunId);
  }
```

For `sdk:mcp-status` and `sdk:task-progress`, wrap existing returns with `markHasTestExecution(...)`.

- [ ] **Step 5: Run reducer tests to verify GREEN**

Run:

```powershell
npm test -- src/app/sdkEventStore.test.ts
```

Expected: PASS for all tests in `sdkEventStore.test.ts`.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/app/sdkUiTypes.ts src/app/sdkEventStore.ts src/app/sdkEventStore.test.ts
git commit --no-gpg-sign -m "feat: 添加会话级测试执行模式状态"
```

---

### Task 2: ClaudeSidebar 左侧导航组件

**Files:**
- Create: `src/app/components/ClaudeSidebar.tsx`
- Create: `src/app/components/ClaudeSidebar.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `src/app/components/ClaudeSidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClaudeSidebar } from "./ClaudeSidebar";

describe("ClaudeSidebar", () => {
  it("renders Claude-style Chinese navigation and resumes recent sessions", async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();
    const onResumeSession = vi.fn();
    const onViewAll = vi.fn();

    render(
      <ClaudeSidebar
        activeRunId="run-2"
        sessions={[
          { id: "run-1", title: "今天的咨询", tags: [] },
          { id: "run-2", title: "订单模块回归", tags: ["测试"] },
        ]}
        onNewChat={onNewChat}
        onResumeSession={onResumeSession}
        onViewAll={onViewAll}
      />,
    );

    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建聊天" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "对话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目" })).toBeInTheDocument();
    expect(screen.getByText("最近")).toBeInTheDocument();
    expect(screen.getByText("订单模块回归")).toBeInTheDocument();
    expect(screen.getByText("专业版")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建聊天" }));
    await user.click(screen.getByRole("button", { name: "今天的咨询" }));
    await user.click(screen.getByRole("button", { name: "查看全部" }));

    expect(onNewChat).toHaveBeenCalled();
    expect(onResumeSession).toHaveBeenCalledWith("run-1");
    expect(onViewAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run sidebar test to verify RED**

Run:

```powershell
npm test -- src/app/components/ClaudeSidebar.test.tsx
```

Expected: FAIL because `ClaudeSidebar` does not exist.

- [ ] **Step 3: Implement minimal ClaudeSidebar**

Create `src/app/components/ClaudeSidebar.tsx`:

```tsx
import { ChevronDown, ChevronRight, Folder, MessageSquare, Plus, Sparkles } from "lucide-react";
import type { SessionSummary } from "../sdkUiTypes";

type Props = {
  activeRunId?: string;
  sessions: SessionSummary[];
  onNewChat: () => void;
  onResumeSession: (sessionId: string) => void;
  onViewAll: () => void;
};

export function ClaudeSidebar({ activeRunId, sessions, onNewChat, onResumeSession, onViewAll }: Props) {
  return (
    <aside className="claude-sidebar" aria-label="会话导航">
      <div className="claude-brand">
        <Sparkles aria-hidden="true" className="claude-brand-icon" size={24} />
        <span>Claude</span>
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
        <button className="recent-view-all" type="button" onClick={onViewAll}>
          <span>查看全部</span>
          <ChevronRight aria-hidden="true" size={16} />
        </button>
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

- [ ] **Step 4: Run sidebar test to verify GREEN**

Run:

```powershell
npm test -- src/app/components/ClaudeSidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/app/components/ClaudeSidebar.tsx src/app/components/ClaudeSidebar.test.tsx
git commit --no-gpg-sign -m "feat: 添加 Claude 风格侧栏组件"
```

---

### Task 3: Composer 悬浮输入组件

**Files:**
- Create: `src/app/components/Composer.tsx`
- Create: `src/app/components/Composer.test.tsx`

- [ ] **Step 1: Write the failing Composer tests**

Create `src/app/components/Composer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("submits trimmed Chinese input and ignores blank input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Composer value="" onChange={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders Claude-style controls with accessible Chinese labels", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(<Composer value="  测试订单模块  " onChange={onChange} onSubmit={onSubmit} />);

    expect(screen.getByLabelText("消息输入")).toHaveAttribute("placeholder", "回复 Claude...");
    expect(screen.getByRole("button", { name: "添加内容" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
    expect(screen.getByText("Claude Sonnet 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(onSubmit).toHaveBeenCalledWith("测试订单模块");
  });
});
```

- [ ] **Step 2: Run Composer tests to verify RED**

Run:

```powershell
npm test -- src/app/components/Composer.test.tsx
```

Expected: FAIL because `Composer` does not exist.

- [ ] **Step 3: Implement minimal Composer**

Create `src/app/components/Composer.tsx`:

```tsx
import { ArrowUp, Plus, Wrench } from "lucide-react";
import { FormEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function Composer({ value, onChange, onSubmit }: Props) {
  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form className="composer-shell" aria-label="消息输入区" onSubmit={submit}>
      <textarea
        aria-label="消息输入"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="回复 Claude..."
        value={value}
      />
      <div className="composer-toolbar">
        <div className="composer-tools">
          <button aria-label="添加内容" className="icon-button" type="button">
            <Plus aria-hidden="true" size={17} />
          </button>
          <button aria-label="工具" className="icon-button" type="button">
            <Wrench aria-hidden="true" size={17} />
          </button>
          <span className="model-pill">Claude Sonnet 4</span>
        </div>
        <button aria-label="发送" className="composer-send" type="submit">
          <ArrowUp aria-hidden="true" size={17} />
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run Composer tests to verify GREEN**

Run:

```powershell
npm test -- src/app/components/Composer.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/app/components/Composer.tsx src/app/components/Composer.test.tsx
git commit --no-gpg-sign -m "feat: 添加 Claude 风格输入框"
```

---

### Task 4: TestConsole 测试监控台组件

**Files:**
- Create: `src/app/components/TestConsole.tsx`
- Create: `src/app/components/TestConsole.test.tsx`

- [ ] **Step 1: Write the failing TestConsole tests**

Create `src/app/components/TestConsole.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestConsole } from "./TestConsole";

describe("TestConsole", () => {
  it("renders Chinese test monitoring content and controls", async () => {
    const user = userEvent.setup();
    const onApprovePlan = vi.fn();
    const onStopTask = vi.fn();

    render(
      <TestConsole
        activeTaskId="task-1"
        mcpServers={[
          { name: "browser", status: "connected" },
          { name: "api", status: "failed" },
          { name: "auth", status: "needs-auth" },
        ]}
        tasks={[{ taskId: "task-1", summary: "执行订单状态检查" }]}
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
    expect(screen.getByText("执行订单状态检查")).toBeInTheDocument();
    expect(screen.getByText("浏览器")).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();
    expect(screen.getByText("接口")).toBeInTheDocument();
    expect(screen.getByText("连接失败")).toBeInTheDocument();
    expect(screen.getByText("需要授权")).toBeInTheDocument();
    expect(screen.getByText("证据 2 条")).toBeInTheDocument();
    expect(screen.getByText("支付回调重复通知导致状态异常")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认执行" }));
    await user.click(screen.getByRole("button", { name: "停止" }));

    expect(onApprovePlan).toHaveBeenCalled();
    expect(onStopTask).toHaveBeenCalledWith("task-1");
  });
});
```

- [ ] **Step 2: Run TestConsole tests to verify RED**

Run:

```powershell
npm test -- src/app/components/TestConsole.test.tsx
```

Expected: FAIL because `TestConsole` does not exist.

- [ ] **Step 3: Implement minimal TestConsole**

Create `src/app/components/TestConsole.tsx`:

```tsx
import { MoreHorizontal } from "lucide-react";
import type { BugDraft, Evidence } from "../../domain/testRun";
import type { McpServerUiStatus, SdkTaskProgress } from "../sdkUiTypes";

type Props = {
  activeTaskId?: string;
  mcpServers: McpServerUiStatus[];
  tasks: SdkTaskProgress[];
  evidence: Evidence[];
  bugDraft?: BugDraft;
  onApprovePlan: () => void;
  onStopTask: (taskId: string) => void;
};

const statusLabels: Record<string, string> = {
  connected: "已连接",
  failed: "连接失败",
  "needs-auth": "需要授权",
  pending: "连接中",
  disabled: "已禁用",
};

const serverLabels: Record<string, string> = {
  browser: "浏览器",
  api: "接口",
  db: "数据库",
  auth: "认证",
};

export function TestConsole({ activeTaskId, mcpServers, tasks, evidence, bugDraft, onApprovePlan, onStopTask }: Props) {
  const latestTask = tasks.at(-1);

  return (
    <aside className="test-console" aria-label="测试监控台">
      <header className="test-console-header">
        <h2>测试监控台</h2>
        <button aria-label="更多测试操作" className="icon-button" type="button">
          <MoreHorizontal aria-hidden="true" size={18} />
        </button>
      </header>
      <div className="test-console-body">
        <section className="monitor-card">
          <h3>计划进度</h3>
          <p>{latestTask?.summary ?? "等待执行测试计划"}</p>
        </section>
        <section className="monitor-card">
          <h3>MCP 服务</h3>
          {mcpServers.map((server) => (
            <div className="monitor-row" key={server.name}>
              <span>{serverLabels[server.name] ?? server.name}</span>
              <span>{statusLabels[server.status] ?? server.status}</span>
            </div>
          ))}
        </section>
        <section className="monitor-card">
          <h3>证据</h3>
          <p>证据 {evidence.length} 条</p>
        </section>
        <section className="monitor-card">
          <h3>缺陷草稿</h3>
          <p>{bugDraft?.title ?? "暂无缺陷草稿"}</p>
        </section>
      </div>
      <footer className="test-console-footer">
        <button className="primary-action" type="button" onClick={onApprovePlan}>确认执行</button>
        <button className="secondary-action" disabled={!activeTaskId} type="button" onClick={() => activeTaskId && onStopTask(activeTaskId)}>停止</button>
      </footer>
    </aside>
  );
}
```

- [ ] **Step 4: Run TestConsole tests to verify GREEN**

Run:

```powershell
npm test -- src/app/components/TestConsole.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add src/app/components/TestConsole.tsx src/app/components/TestConsole.test.tsx
git commit --no-gpg-sign -m "feat: 添加测试监控台组件"
```

---

### Task 5: 聊天流中文化和助手操作收敛

**Files:**
- Modify: `src/app/components/MessageStream.tsx`
- Modify: `src/app/components/MessageStream.test.tsx`
- Modify: `src/app/components/ToolApprovalCard.tsx`
- Modify: `src/app/components/ToolApprovalCard.test.tsx`
- Modify: `src/app/components/AskUserQuestionCard.tsx`
- Modify: `src/app/components/AskUserQuestionCard.test.tsx`

- [ ] **Step 1: Replace MessageStream test with failing expectations**

Update `src/app/components/MessageStream.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageStream } from "./MessageStream";

describe("MessageStream", () => {
  it("renders Claude-style chat content without MCP status or reaction controls", () => {
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
        toolCall: { id: "approval-1", toolName: "mcp-db.query", label: "查询订单", status: "waiting_approval" },
      }],
      questions: [{ runId: "run-1", requestId: "question-1", questions: [{ id: "scope", label: "测试范围" }] }],
      mcpServers: [{ name: "browser", status: "connected" }],
      evidence: [],
      rawMessages: [{ type: "system", subtype: "compact_boundary" }],
      usage: { input_tokens: 10 },
      errors: [{ message: "网关认证失败", retryable: true }],
      tasks: [{ taskId: "task-1", summary: "正在执行子任务" }],
      sessions: [],
    }} onApprove={vi.fn()} onDeny={vi.fn()} onAnswer={vi.fn()} />);

    expect(screen.getByText("帮我分析订单风险")).toBeInTheDocument();
    expect(screen.getByText("正在生成计划")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "复制回复" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "重试回复" })).toHaveLength(1);
    expect(screen.getByText("查询订单")).toBeInTheDocument();
    expect(screen.getByText("需要补充信息")).toBeInTheDocument();
    expect(screen.queryByText("browser connected")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("收藏回复")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("赞同回复")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("反对回复")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Update ToolApprovalCard test with failing Chinese labels**

In `src/app/components/ToolApprovalCard.test.tsx`, replace button expectations:

```tsx
    fireEvent.change(screen.getByLabelText("调整工具输入"), { target: { value: "{\"limit\":1}" } });
    await user.click(screen.getByRole("checkbox", { name: "应用权限建议" }));
    await user.click(screen.getByRole("button", { name: "允许" }));
    await user.click(screen.getByRole("button", { name: "拒绝" }));
```

- [ ] **Step 3: Run component tests to verify RED**

Run:

```powershell
npm test -- src/app/components/MessageStream.test.tsx src/app/components/ToolApprovalCard.test.tsx src/app/components/AskUserQuestionCard.test.tsx
```

Expected: FAIL because current components still render MCP status in message stream and old approval labels.

- [ ] **Step 4: Implement minimal MessageStream changes**

In `src/app/components/MessageStream.tsx`, import icons:

```tsx
import { Copy, RefreshCcw, Sparkles } from "lucide-react";
```

Replace message rendering:

```tsx
      {state.messages.map((message) => (
        <article className={`message ${message.role}-message`} key={message.id}>
          {message.role === "assistant" ? (
            <>
              <Sparkles aria-hidden="true" className="assistant-mark" size={22} />
              <div>
                <p>{message.content}</p>
                <div className="assistant-actions">
                  <button aria-label="复制回复" type="button"><Copy aria-hidden="true" size={14} />复制</button>
                  <button aria-label="重试回复" type="button"><RefreshCcw aria-hidden="true" size={14} />重试</button>
                </div>
              </div>
            </>
          ) : message.content}
        </article>
      ))}
```

Remove this MCP status block from `MessageStream`:

```tsx
      {state.mcpServers.length ? (
        <section className="sdk-status-list" aria-label="MCP 状态">
          {state.mcpServers.map((server) => <span key={server.name}>{server.name} {server.status}</span>)}
        </section>
      ) : null}
```

- [ ] **Step 5: Implement minimal ToolApprovalCard label changes**

In `src/app/components/ToolApprovalCard.tsx`, change labels:

```tsx
      <label>
        调整工具输入
        <textarea value={inputText} onChange={(event) => setInputText(event.currentTarget.value)} />
        {parseError ? <span className="sdk-error">{parseError}</span> : null}
      </label>
      <label className="checkbox-line">
        <input type="checkbox" checked={applySuggestions} onChange={(event) => setApplySuggestions(event.currentTarget.checked)} />
        应用权限建议
      </label>
```

Change buttons:

```tsx
        <button type="button" onClick={() => onApprove(request.runId, request.requestId, {
          updatedInput: parseInput(),
          applyPermissionSuggestions: applySuggestions,
        })}>
          允许
        </button>
        <button type="button" onClick={() => onDeny(request.runId, request.requestId, "用户拒绝了工具调用")}>拒绝</button>
```

- [ ] **Step 6: Run component tests to verify GREEN**

Run:

```powershell
npm test -- src/app/components/MessageStream.test.tsx src/app/components/ToolApprovalCard.test.tsx src/app/components/AskUserQuestionCard.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```powershell
git add src/app/components/MessageStream.tsx src/app/components/MessageStream.test.tsx src/app/components/ToolApprovalCard.tsx src/app/components/ToolApprovalCard.test.tsx src/app/components/AskUserQuestionCard.tsx src/app/components/AskUserQuestionCard.test.tsx
git commit --no-gpg-sign -m "feat: 收敛聊天流交互文案"
```

---

### Task 6: App 双模式布局整合

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Write failing App tests for dual-mode behavior**

Add these tests to `src/app/App.test.tsx`:

```tsx
  it("keeps ordinary chat in a two-column layout without the test console", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("navigation", { name: "会话导航" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "测试监控台" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("消息输入"), "帮我分析订单测试风险");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(send).toHaveBeenCalledWith("run:create", { prompt: "帮我分析订单测试风险" });

    emit("assistant:text-delta", { runId: "run-1", messageId: "msg-1", delta: "普通分析结果" });
    emit("run:plan-ready", {
      runId: "run-1",
      plan: [{ id: "step-1", title: "分析风险", status: "pending" }],
    });
    emit("question:required", {
      runId: "run-1",
      requestId: "question-1",
      questions: [{ id: "scope", label: "测试范围" }],
    });

    expect(await screen.findByText("普通分析结果")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "测试监控台" })).not.toBeInTheDocument();
  });

  it("shows the test console immediately after plan execution is confirmed", async () => {
    const user = userEvent.setup();
    render(<App />);

    emit("assistant:text-delta", { runId: "run-1", messageId: "msg-1", delta: "计划草稿" });

    await user.click(screen.getByRole("button", { name: "确认计划并执行" }));

    expect(send).toHaveBeenCalledWith("run:approve-plan", { runId: "run-1" });
    expect(screen.getByRole("complementary", { name: "测试监控台" })).toBeInTheDocument();
  });

  it("shows the test console when backend execution evidence arrives", () => {
    render(<App />);

    emit("tool:approval-required", {
      runId: "run-1",
      requestId: "approval-1",
      toolCall: { id: "approval-1", toolName: "browser.open", label: "打开订单列表", status: "waiting_approval" },
    });

    expect(screen.getByRole("complementary", { name: "测试监控台" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run App tests to verify RED**

Run:

```powershell
npm test -- src/app/App.test.tsx
```

Expected: FAIL because current UI has no `ClaudeSidebar`, no single `Composer`, and no `TestConsole`.

- [ ] **Step 3: Implement App composition**

In `src/app/App.tsx`, replace imports:

```tsx
import { FormEvent, useEffect, useMemo, useReducer, useState } from "react";
import { createBackendBridge } from "./backendBridge";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";
import { ClaudeSidebar } from "./components/ClaudeSidebar";
import { Composer } from "./components/Composer";
import { MessageStream } from "./components/MessageStream";
import { TestConsole } from "./components/TestConsole";
import "../ui/styles.css";
```

Replace state and handlers:

```tsx
  const [composerValue, setComposerValue] = useState("");
  const [state, dispatch] = useReducer(reduceSdkUiEvent, undefined, createInitialSdkUiState);
  const bridge = useMemo(() => createBackendBridge(window.aiTestAssistant ?? fallbackApi), []);
  const activeRunId = state.activeRunId;
  const activeTaskId = state.tasks.at(-1)?.taskId;
  const shouldShowTestConsole = Boolean(activeRunId && state.workspaceModes[activeRunId]?.hasTestExecution);
```

Add submit handler:

```tsx
  function handleComposerSubmit(value: string) {
    if (activeRunId) {
      bridge.sendMessage(activeRunId, value);
    } else {
      bridge.createRun(value);
    }
    setComposerValue("");
  }

  function handleApprovePlan() {
    const runId = activeRunId ?? "run-1";
    dispatch({ channel: "ui:test-execution-confirmed", payload: { runId } });
    bridge.approvePlan(runId);
  }
```

Replace JSX:

```tsx
  return (
    <div className={shouldShowTestConsole ? "app-shell test-mode" : "app-shell chat-mode"}>
      <ClaudeSidebar
        activeRunId={activeRunId}
        sessions={state.sessions}
        onNewChat={() => setComposerValue("")}
        onResumeSession={(sessionId) => activeRunId && bridge.resumeSession(activeRunId, sessionId)}
        onViewAll={() => bridge.listSessions()}
      />
      <main className="conversation" aria-label="对话">
        <header className="conversation-header">
          <button className="conversation-title" type="button">
            {activeRunId ?? "新对话"}
          </button>
        </header>
        <MessageStream
          state={state}
          onApprove={bridge.approveTool}
          onDeny={bridge.denyTool}
          onAnswer={bridge.answerQuestion}
        />
        <div className="plan-action-row">
          <button className="primary-action" type="button" onClick={handleApprovePlan}>
            确认计划并执行
          </button>
        </div>
        <Composer value={composerValue} onChange={setComposerValue} onSubmit={handleComposerSubmit} />
      </main>
      {shouldShowTestConsole ? (
        <TestConsole
          activeTaskId={activeTaskId}
          mcpServers={state.mcpServers}
          tasks={state.tasks}
          evidence={state.evidence}
          bugDraft={state.bugDraft}
          onApprovePlan={handleApprovePlan}
          onStopTask={(taskId) => activeRunId && bridge.stopTask(activeRunId, taskId)}
        />
      ) : null}
    </div>
  );
```

- [ ] **Step 4: Run App tests to verify GREEN**

Run:

```powershell
npm test -- src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add src/app/App.tsx src/app/App.test.tsx
git commit --no-gpg-sign -m "feat: 整合双模式工作区布局"
```

---

### Task 7: Claude Desktop 风格 CSS

**Files:**
- Modify: `src/ui/styles.css`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Add failing class assertions**

In the App tests from Task 6, add these assertions:

```tsx
    expect(document.querySelector(".app-shell.chat-mode")).toBeInTheDocument();
```

In the test that shows console after confirmation, add:

```tsx
    expect(document.querySelector(".app-shell.test-mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加内容" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
```

- [ ] **Step 2: Run App tests to verify RED if class names are missing**

Run:

```powershell
npm test -- src/app/App.test.tsx
```

Expected: FAIL if `chat-mode` or `test-mode` classes are not wired. If this passes because Task 6 already added those classes, continue to Step 3 and treat the style implementation as refactor under green tests.

- [ ] **Step 3: Replace CSS with Claude-style layout**

In `src/ui/styles.css`, replace the current stylesheet with a focused version using these selectors and values:

```css
:root {
  color: #2a2621;
  background: #fdfbf7;
  font-family:
    Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 1040px;
  min-height: 100vh;
  background: #fdfbf7;
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

.app-shell {
  display: grid;
  height: 100vh;
  background: #fdfbf7;
}

.app-shell.chat-mode {
  grid-template-columns: 252px minmax(0, 1fr);
}

.app-shell.test-mode {
  grid-template-columns: 252px minmax(0, 1fr) 300px;
}

.claude-sidebar {
  background: #f4efe7;
  border-right: 1px solid #e1dbd2;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  min-width: 0;
}

.claude-brand {
  align-items: center;
  border-bottom: 1px solid #e7e1d8;
  display: flex;
  gap: 10px;
  padding: 18px 20px 15px;
  font-size: 20px;
  font-weight: 650;
}

.claude-brand-icon,
.assistant-mark {
  color: #d96f4f;
}

.claude-nav,
.recent-section {
  display: grid;
  gap: 7px;
  padding: 14px 10px 0;
}

.claude-nav-item,
.recent-session,
.recent-view-all {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: #514b43;
  display: flex;
  gap: 12px;
  justify-content: flex-start;
  min-height: 36px;
  padding: 8px 12px;
  text-align: left;
}

.claude-nav-item.active,
.recent-session.active {
  background: #eadbcc;
  color: #2d2924;
  font-weight: 650;
}

.recent-title {
  color: #756d63;
  font-size: 12px;
  margin: 18px 0 3px;
  padding: 0 12px;
}

.recent-view-all {
  justify-content: space-between;
}

.claude-profile {
  align-items: center;
  border-top: 1px solid #e7e1d8;
  display: flex;
  gap: 10px;
  justify-content: space-between;
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
  background: #fdfbf7;
  display: grid;
  grid-template-rows: 54px 1fr;
  min-width: 0;
  position: relative;
}

.conversation-header {
  align-items: center;
  display: flex;
  padding: 0 26px;
}

.conversation-title {
  background: transparent;
  border: 0;
  color: #2a2621;
  font-size: 14px;
  font-weight: 650;
}

.message-stream {
  align-content: start;
  display: grid;
  gap: 18px;
  justify-items: center;
  overflow: auto;
  padding: 18px 0 132px;
}

.message {
  max-width: 650px;
  width: min(650px, calc(100% - 72px));
}

.user-message {
  background: #f1eee9;
  border-radius: 13px;
  justify-self: center;
  line-height: 1.58;
  padding: 12px 14px;
}

.assistant-message {
  background: #fffefb;
  border: 1px solid #e7e1d8;
  border-radius: 12px;
  display: grid;
  gap: 12px;
  grid-template-columns: 26px 1fr;
  line-height: 1.72;
  padding: 15px 16px 13px;
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
  color: #6f675e;
  display: inline-flex;
  font-size: 12px;
  gap: 5px;
}

.composer-shell {
  background: #fffefb;
  border: 1px solid #dfd9d0;
  border-radius: 12px;
  bottom: 18px;
  box-shadow: 0 8px 28px rgba(50, 38, 25, 0.1);
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
  color: #2a2621;
  outline: 0;
  resize: none;
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
  background: #fffefb;
  border: 1px solid #e2dcd4;
  color: #4f4a44;
}

.composer-send {
  background: #d98b72;
  border: 0;
  color: #fff;
}

.model-pill {
  align-items: center;
  background: #eef1f6;
  border: 1px solid #dce2ec;
  border-radius: 8px;
  color: #465369;
  display: inline-flex;
  font-size: 12px;
  height: 31px;
  padding: 0 10px;
}

.test-console {
  background: #faf7f1;
  border-left: 1px solid #e1dbd2;
  display: grid;
  grid-template-rows: 54px 1fr auto;
  min-width: 0;
}

.test-console-header,
.test-console-footer {
  align-items: center;
  display: flex;
  gap: 8px;
  padding: 0 14px;
}

.test-console-header {
  border-bottom: 1px solid #e7e1d8;
  justify-content: space-between;
}

.test-console-header h2 {
  font-size: 14px;
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
  background: #fffefb;
  border: 1px solid #e7e1d8;
  border-radius: 11px;
  display: grid;
  gap: 8px;
  padding: 12px;
}

.monitor-card h3 {
  font-size: 13px;
  margin: 0;
}

.monitor-card p,
.monitor-row {
  color: #6f675e;
  font-size: 12px;
  margin: 0;
}

.monitor-row {
  display: flex;
  justify-content: space-between;
}

.test-console-footer {
  border-top: 1px solid #e7e1d8;
  padding-bottom: 14px;
  padding-top: 12px;
}

.primary-action,
.secondary-action {
  border-radius: 8px;
  min-height: 34px;
  padding: 0 12px;
}

.primary-action {
  background: #d98b72;
  border: 0;
  color: #fff;
}

.secondary-action {
  background: #fffefb;
  border: 1px solid #ddd5cb;
  color: #4f4a44;
}
```

- [ ] **Step 4: Run App and component tests to verify GREEN**

Run:

```powershell
npm test -- src/app/App.test.tsx src/app/components/Composer.test.tsx src/app/components/ClaudeSidebar.test.tsx src/app/components/TestConsole.test.tsx src/app/components/MessageStream.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```powershell
git add src/ui/styles.css src/app/App.test.tsx
git commit --no-gpg-sign -m "style: 应用 Claude Desktop 视觉系统"
```

---

### Task 8: E2E 双模式验证

**Files:**
- Modify: `tests/e2e/ai-test-flow.spec.ts`

- [ ] **Step 1: Replace E2E spec with dual-mode assertions**

Update `tests/e2e/ai-test-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("ordinary chat stays in chat mode before test execution", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "会话导航" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "测试监控台" })).toHaveCount(0);

  await page.getByLabel("消息输入").fill("帮我分析订单模块测试风险");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("测试监控台")).toHaveCount(0);
});

test("confirmed execution opens the test console", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("消息输入").fill("测试订单模块功能");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "确认计划并执行" }).click();

  await expect(page.getByRole("complementary", { name: "测试监控台" })).toBeVisible();
  await expect(page.getByText("MCP 服务")).toBeVisible();
  await expect(page.getByText("证据")).toBeVisible();
});
```

- [ ] **Step 2: Run E2E to verify RED or current mismatch**

Run:

```powershell
npm run e2e
```

Expected before full integration: FAIL if the app is still old UI. If implementation tasks are already complete, this may pass; in that case record that Task 8 is validating completed behavior.

- [ ] **Step 3: Fix only E2E-related missing accessibility labels**

If E2E fails because a label is absent, update the relevant component with the exact label from the test:

- `ClaudeSidebar` root: `aria-label="会话导航"`
- `Composer` textarea: `aria-label="消息输入"`
- `TestConsole` root: `aria-label="测试监控台"`
- Send button: `aria-label="发送"`

- [ ] **Step 4: Run E2E to verify GREEN**

Run:

```powershell
npm run e2e
```

Expected: PASS.

- [ ] **Step 5: Commit Task 8**

```powershell
git add tests/e2e/ai-test-flow.spec.ts src/app/components/ClaudeSidebar.tsx src/app/components/Composer.tsx src/app/components/TestConsole.tsx
git commit --no-gpg-sign -m "test: 覆盖双模式工作区端到端流程"
```

---

### Task 9: Final verification and cleanup

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
npm test
```

Expected: PASS with 0 failed tests.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: exit code 0. This verifies TypeScript for renderer and Electron code plus Vite build.

- [ ] **Step 3: Run E2E**

Run:

```powershell
npm run e2e
```

Expected: PASS.

- [ ] **Step 4: Inspect Git diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only files listed in this plan are modified. `.superpowers/` and `.playwright-mcp/` must not appear as untracked files because they are ignored.

- [ ] **Step 5: Commit final cleanup if needed**

If Step 4 shows style-only cleanup or test updates not committed by prior tasks:

```powershell
git add src/app src/ui/styles.css tests/e2e/ai-test-flow.spec.ts
git commit --no-gpg-sign -m "chore: 完成 Claude Desktop UI 重构验证"
```

---

## Self-Review

Spec coverage:

- 普通聊天模式不显示右侧栏：Task 1 reducer tests, Task 6 App tests, Task 8 E2E.
- 点击“确认计划并执行”立即显示右侧栏：Task 1 local event, Task 6 App tests.
- 工具/证据/缺陷事件兜底显示右侧栏：Task 1 reducer tests, Task 6 App tests.
- 历史会话按 run mode 隔离：Task 1 multiple run isolation; Task 6 active run mode lookup.
- Claude Desktop 风格左侧导航：Task 2 and Task 7.
- 中央消息列和悬浮输入框：Task 3, Task 6, Task 7.
- 右侧标题“测试监控台”：Task 4, Task 6, Task 8.
- 中文界面：Task 2, Task 3, Task 4, Task 5, Task 8.
- 助手回复不显示收藏/点赞/点踩：Task 5.
- MCP 状态迁移到测试监控台：Task 4 and Task 5.

Placeholder scan:

- Plan contains no open implementation markers.
- Every task includes test command, expected failure/pass, implementation target, and commit command.

Type consistency:

- `workspaceModes` is defined in `SdkUiState` before `App` consumes it.
- `evidence` and `bugDraft` are defined in `SdkUiState` before `TestConsole` consumes them.
- `ui:test-execution-confirmed` is included in `SdkUiEvent` before `App` dispatches it.
