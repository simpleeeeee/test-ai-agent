# AI 测试助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable version of the Chinese AI testing desktop app: Claude Desktop style conversation UI, natural-language test request, plan confirmation, MCP tool event stream, approval gates, evidence drawer, and bug draft.

**Architecture:** Use Electron for the desktop shell, React/Vite for the renderer, and a pure TypeScript domain layer for run state transitions. The first implementation uses a deterministic fake Agent/MCP runtime behind the same event contracts the real Claude Agent SDK integration will later use, so UI and orchestration can be tested before connecting real services.

**Tech Stack:** Electron, Vite, React, TypeScript, Vitest, React Testing Library, Playwright, lucide-react.

---

## TDD Rules For This Plan

Follow `superpowers:test-driven-development` strictly.

- No production code before a failing test.
- Every behavior task starts with a RED test.
- Watch each test fail for the expected reason.
- Implement the smallest production code to pass.
- Re-run the specific test, then the relevant suite.
- Commit after each task when Git is available.

Configuration-only files are allowed in Task 1 because no production behavior exists yet, but every behavior after Task 1 must be test-first.

## File Structure

- `package.json`: npm scripts and dependencies.
- `tsconfig.json`: shared TypeScript config.
- `tsconfig.node.json`: Electron/main-process TypeScript config.
- `vite.config.ts`: renderer Vite config.
- `vitest.config.ts`: unit and React test config.
- `playwright.config.ts`: browser/e2e config.
- `index.html`: renderer entry HTML.
- `electron/main.ts`: Electron app bootstrap.
- `electron/preload.ts`: safe IPC bridge.
- `src/main.tsx`: React entry.
- `src/app/App.tsx`: top-level layout composition.
- `src/app/App.test.tsx`: application-level behavior tests.
- `src/domain/testRun.ts`: test run types, factories, and reducer.
- `src/domain/testRun.test.ts`: domain behavior tests.
- `src/agent/fakeAgentRuntime.ts`: deterministic fake Agent/MCP event runtime.
- `src/agent/fakeAgentRuntime.test.ts`: runtime event tests.
- `src/ipc/channels.ts`: typed IPC channel names and payloads.
- `src/ipc/channels.test.ts`: IPC contract tests.
- `src/ui/components/*.tsx`: focused UI components.
- `src/ui/components/*.test.tsx`: component behavior tests.
- `src/ui/styles.css`: Claude Desktop style visual system.
- `src/test/setup.ts`: test environment setup.
- `tests/e2e/ai-test-flow.spec.ts`: user-flow smoke test.

## Task 1: Scaffold Toolchain And Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `index.html`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.ts`

- [ ] **Step 1: Create package and TypeScript/Vite/Vitest config**

Create `package.json`:

```json
{
  "name": "ai-test-assistant",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "electron": "electron ."
  },
  "main": "dist-electron/main.js",
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "electron": "^33.0.0",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["electron"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
  },
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI 测试助手</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/test/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs TypeScript tests", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: dependencies install without errors and `package-lock.json` is created.

- [ ] **Step 3: Run smoke test**

Run:

```bash
npm test -- src/test/smoke.test.ts
```

Expected: PASS with `runs TypeScript tests`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts playwright.config.ts index.html src/test/setup.ts src/test/smoke.test.ts
git commit -m "chore: scaffold test harness"
```

Expected: commit created. If `git` is unavailable, record the blocker before continuing.

## Task 2: Domain Model And Initial Run Factory

**Files:**
- Create: `src/domain/testRun.test.ts`
- Create: `src/domain/testRun.ts`

- [ ] **Step 1: Write failing domain test**

Create `src/domain/testRun.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInitialRun } from "./testRun";

describe("createInitialRun", () => {
  it("creates a Chinese test run from a natural language prompt", () => {
    const run = createInitialRun({
      prompt: "测试订单模块功能",
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });

    expect(run.title).toBe("测试订单模块功能");
    expect(run.status).toBe("idle");
    expect(run.userPrompt).toBe("测试订单模块功能");
    expect(run.projectName).toBe("电商后台");
    expect(run.environmentName).toBe("QA");
    expect(run.agentName).toBe("订单测试 Agent");
    expect(run.plan).toEqual([]);
    expect(run.toolCalls).toEqual([]);
    expect(run.evidence).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/domain/testRun.test.ts
```

Expected: FAIL with an import or missing module error for `src/domain/testRun`.

- [ ] **Step 3: Implement minimal domain types and factory**

Create `src/domain/testRun.ts`:

```ts
export type RunStatus =
  | "idle"
  | "planning"
  | "waiting_confirmation"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "blocked"
  | "stopped";

export type ToolCallStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export type TestPlanStep = {
  id: string;
  title: string;
  status: "pending" | "running" | "passed" | "failed" | "blocked";
};

export type ToolCall = {
  id: string;
  toolName: string;
  label: string;
  status: ToolCallStatus;
  inputSummary?: string;
  outputSummary?: string;
  approvalReason?: string;
};

export type Evidence = {
  id: string;
  type: "screenshot" | "api_response" | "database_record" | "log" | "dom";
  title: string;
  summary: string;
  uri?: string;
};

export type BugDraft = {
  title: string;
  severity: "P0" | "P1" | "P2" | "P3";
  steps: string[];
  expected: string;
  actual: string;
  evidenceIds: string[];
};

export type TestRun = {
  id: string;
  title: string;
  userPrompt: string;
  status: RunStatus;
  projectName: string;
  environmentName: string;
  agentName: string;
  plan: TestPlanStep[];
  toolCalls: ToolCall[];
  evidence: Evidence[];
  bugDraft?: BugDraft;
};

type CreateInitialRunInput = {
  prompt: string;
  projectName: string;
  environmentName: string;
  agentName: string;
};

export function createInitialRun(input: CreateInitialRunInput): TestRun {
  const prompt = input.prompt.trim();

  return {
    id: crypto.randomUUID(),
    title: prompt,
    userPrompt: prompt,
    status: "idle",
    projectName: input.projectName,
    environmentName: input.environmentName,
    agentName: input.agentName,
    plan: [],
    toolCalls: [],
    evidence: [],
  };
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- src/domain/testRun.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/testRun.ts src/domain/testRun.test.ts
git commit -m "feat: add test run domain model"
```

Expected: commit created.

## Task 3: Run Event Reducer

**Files:**
- Modify: `src/domain/testRun.test.ts`
- Modify: `src/domain/testRun.ts`

- [ ] **Step 1: Add failing reducer tests**

Append to `src/domain/testRun.test.ts`:

```ts
import { applyRunEvent } from "./testRun";

describe("applyRunEvent", () => {
  it("moves from planning to waiting confirmation when a plan is ready", () => {
    const run = createInitialRun({
      prompt: "测试订单模块功能",
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });

    const planning = applyRunEvent(run, { type: "run:planning" });
    const planned = applyRunEvent(planning, {
      type: "run:plan-ready",
      plan: [
        { id: "step-1", title: "登录测试账号", status: "pending" },
        { id: "step-2", title: "创建测试订单", status: "pending" },
      ],
    });

    expect(planning.status).toBe("planning");
    expect(planned.status).toBe("waiting_confirmation");
    expect(planned.plan).toHaveLength(2);
  });

  it("tracks tool calls, evidence, and bug drafts", () => {
    const run = createInitialRun({
      prompt: "测试订单模块功能",
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });

    const withTool = applyRunEvent(run, {
      type: "tool:call-started",
      toolCall: {
        id: "tool-1",
        toolName: "mcp-order.createOrder",
        label: "创建测试订单",
        status: "running",
      },
    });
    const withEvidence = applyRunEvent(withTool, {
      type: "evidence:created",
      evidence: {
        id: "ev-1",
        type: "api_response",
        title: "创建订单响应",
        summary: "订单创建成功",
      },
    });
    const withBug = applyRunEvent(withEvidence, {
      type: "bug-draft:created",
      bugDraft: {
        title: "订单取消后状态未同步",
        severity: "P1",
        steps: ["创建订单", "取消订单", "查询订单状态"],
        expected: "订单状态为已取消",
        actual: "订单状态仍为待支付",
        evidenceIds: ["ev-1"],
      },
    });

    expect(withTool.toolCalls[0].status).toBe("running");
    expect(withEvidence.evidence[0].title).toBe("创建订单响应");
    expect(withBug.bugDraft?.severity).toBe("P1");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/domain/testRun.test.ts
```

Expected: FAIL because `applyRunEvent` is not exported.

- [ ] **Step 3: Implement minimal reducer**

Append to `src/domain/testRun.ts`:

```ts
export type RunEvent =
  | { type: "run:planning" }
  | { type: "run:plan-ready"; plan: TestPlanStep[] }
  | { type: "run:status-changed"; status: RunStatus }
  | { type: "tool:call-started"; toolCall: ToolCall }
  | { type: "tool:approval-required"; toolCall: ToolCall }
  | { type: "tool:call-completed"; toolCallId: string; outputSummary?: string }
  | { type: "tool:call-failed"; toolCallId: string; outputSummary?: string }
  | { type: "evidence:created"; evidence: Evidence }
  | { type: "bug-draft:created"; bugDraft: BugDraft };

export function applyRunEvent(run: TestRun, event: RunEvent): TestRun {
  switch (event.type) {
    case "run:planning":
      return { ...run, status: "planning" };
    case "run:plan-ready":
      return { ...run, status: "waiting_confirmation", plan: event.plan };
    case "run:status-changed":
      return { ...run, status: event.status };
    case "tool:call-started":
      return { ...run, toolCalls: [...run.toolCalls, event.toolCall] };
    case "tool:approval-required":
      return {
        ...run,
        status: "waiting_approval",
        toolCalls: [...run.toolCalls, { ...event.toolCall, status: "waiting_approval" }],
      };
    case "tool:call-completed":
      return updateToolCall(run, event.toolCallId, {
        status: "completed",
        outputSummary: event.outputSummary,
      });
    case "tool:call-failed":
      return updateToolCall(run, event.toolCallId, {
        status: "failed",
        outputSummary: event.outputSummary,
      });
    case "evidence:created":
      return { ...run, evidence: [...run.evidence, event.evidence] };
    case "bug-draft:created":
      return { ...run, bugDraft: event.bugDraft };
  }
}

function updateToolCall(
  run: TestRun,
  toolCallId: string,
  patch: Partial<ToolCall>,
): TestRun {
  return {
    ...run,
    toolCalls: run.toolCalls.map((toolCall) =>
      toolCall.id === toolCallId ? { ...toolCall, ...patch } : toolCall,
    ),
  };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/domain/testRun.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/testRun.ts src/domain/testRun.test.ts
git commit -m "feat: add run event reducer"
```

Expected: commit created.

## Task 4: Fake Agent Runtime Event Stream

**Files:**
- Create: `src/agent/fakeAgentRuntime.test.ts`
- Create: `src/agent/fakeAgentRuntime.ts`

- [ ] **Step 1: Write failing runtime test**

Create `src/agent/fakeAgentRuntime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runFakeAgent } from "./fakeAgentRuntime";

describe("runFakeAgent", () => {
  it("streams a plan and MCP tool events for an order module prompt", async () => {
    const events = [];

    for await (const event of runFakeAgent("测试订单模块功能")) {
      events.push(event);
    }

    expect(events[0]).toEqual({ type: "run:planning" });
    expect(events).toContainEqual({
      type: "run:plan-ready",
      plan: [
        { id: "plan-login", title: "登录测试账号", status: "pending" },
        { id: "plan-create-order", title: "创建测试订单", status: "pending" },
        { id: "plan-update-order", title: "修改订单信息", status: "pending" },
        { id: "plan-check-status", title: "校验订单状态", status: "pending" },
      ],
    });
    expect(events).toContainEqual({
      type: "tool:approval-required",
      toolCall: {
        id: "tool-query-order",
        toolName: "mcp-db.queryOrder",
        label: "查询订单数据库",
        status: "waiting_approval",
        approvalReason: "AI 请求查询订单数据库",
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/agent/fakeAgentRuntime.test.ts
```

Expected: FAIL because `runFakeAgent` does not exist.

- [ ] **Step 3: Implement deterministic fake runtime**

Create `src/agent/fakeAgentRuntime.ts`:

```ts
import type { RunEvent } from "../domain/testRun";

export async function* runFakeAgent(prompt: string): AsyncGenerator<RunEvent> {
  const normalizedPrompt = prompt.trim();

  yield { type: "run:planning" };

  if (normalizedPrompt.includes("订单")) {
    yield {
      type: "run:plan-ready",
      plan: [
        { id: "plan-login", title: "登录测试账号", status: "pending" },
        { id: "plan-create-order", title: "创建测试订单", status: "pending" },
        { id: "plan-update-order", title: "修改订单信息", status: "pending" },
        { id: "plan-check-status", title: "校验订单状态", status: "pending" },
      ],
    };
    yield { type: "run:status-changed", status: "running" };
    yield {
      type: "tool:call-started",
      toolCall: {
        id: "tool-login",
        toolName: "mcp-user.login",
        label: "登录测试账号",
        status: "running",
      },
    };
    yield {
      type: "tool:call-completed",
      toolCallId: "tool-login",
      outputSummary: "测试账号登录成功",
    };
    yield {
      type: "tool:approval-required",
      toolCall: {
        id: "tool-query-order",
        toolName: "mcp-db.queryOrder",
        label: "查询订单数据库",
        status: "waiting_approval",
        approvalReason: "AI 请求查询订单数据库",
      },
    };
    return;
  }

  yield {
    type: "run:plan-ready",
    plan: [{ id: "plan-generic", title: "分析测试目标", status: "pending" }],
  };
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- src/agent/fakeAgentRuntime.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent/fakeAgentRuntime.ts src/agent/fakeAgentRuntime.test.ts
git commit -m "feat: add fake agent event stream"
```

Expected: commit created.

## Task 5: IPC Contract And Safe Channel List

**Files:**
- Create: `src/ipc/channels.test.ts`
- Create: `src/ipc/channels.ts`

- [ ] **Step 1: Write failing IPC contract test**

Create `src/ipc/channels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRendererToMainChannel, rendererToMainChannels } from "./channels";

describe("IPC channels", () => {
  it("allows only explicit renderer-to-main channels", () => {
    expect(isRendererToMainChannel("run:create")).toBe(true);
    expect(isRendererToMainChannel("tool:approve")).toBe(true);
    expect(isRendererToMainChannel("shell:openExternal")).toBe(false);
  });

  it("contains the spec-defined renderer-to-main actions", () => {
    expect(rendererToMainChannels).toEqual([
      "run:create",
      "run:approve-plan",
      "run:revise-plan",
      "tool:approve",
      "tool:deny",
      "run:stop",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/ipc/channels.test.ts
```

Expected: FAIL because `src/ipc/channels.ts` does not exist.

- [ ] **Step 3: Implement IPC contracts**

Create `src/ipc/channels.ts`:

```ts
export const rendererToMainChannels = [
  "run:create",
  "run:approve-plan",
  "run:revise-plan",
  "tool:approve",
  "tool:deny",
  "run:stop",
] as const;

export const mainToRendererChannels = [
  "run:created",
  "run:planning",
  "run:plan-ready",
  "run:status-changed",
  "tool:call-started",
  "tool:approval-required",
  "tool:call-completed",
  "tool:call-failed",
  "evidence:created",
  "bug-draft:created",
] as const;

export type RendererToMainChannel = (typeof rendererToMainChannels)[number];
export type MainToRendererChannel = (typeof mainToRendererChannels)[number];

export function isRendererToMainChannel(value: string): value is RendererToMainChannel {
  return rendererToMainChannels.includes(value as RendererToMainChannel);
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/ipc/channels.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ipc/channels.ts src/ipc/channels.test.ts
git commit -m "feat: define ipc channel contracts"
```

Expected: commit created.

## Task 6: App Shell With Claude Desktop Layout

**Files:**
- Create: `src/main.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/app/App.tsx`
- Create: `src/ui/styles.css`

- [ ] **Step 1: Write failing app shell test**

Create `src/app/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App shell", () => {
  it("renders a Chinese Claude Desktop style conversation workspace", () => {
    render(<App />);

    expect(screen.getByText("AI 测试助手")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建测试" })).toBeInTheDocument();
    expect(screen.getByText("订单模块测试")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入你想测试的功能，例如：测试订单模块功能")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 3: Implement minimal app shell**

Create `src/app/App.tsx`:

```tsx
import { Plus, Send, Settings } from "lucide-react";
import "../ui/styles.css";

const sessions = ["订单模块测试", "支付回归", "优惠券异常"];

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="会话列表">
        <div className="sidebar-header">
          <div className="app-title">AI 测试助手</div>
          <button className="new-test-button" type="button">
            <Plus size={16} />
            新建测试
          </button>
        </div>
        <nav className="session-list" aria-label="最近会话">
          {sessions.map((session, index) => (
            <button
              className={index === 0 ? "session-item active" : "session-item"}
              key={session}
              type="button"
            >
              {session}
            </button>
          ))}
        </nav>
        <button className="settings-button" type="button">
          <Settings size={16} />
          设置
        </button>
      </aside>
      <main className="conversation" aria-label="测试对话">
        <header className="conversation-header">
          <div>
            <p className="eyebrow">当前会话</p>
            <h1>订单模块测试</h1>
          </div>
          <span className="status-chip">空闲</span>
        </header>
        <section className="empty-state">
          <h2>输入测试目标，AI 会生成计划并调用 MCP 工具执行。</h2>
          <p>例如：测试订单模块功能</p>
        </section>
        <form className="composer">
          <textarea
            aria-label="测试目标"
            placeholder="输入你想测试的功能，例如：测试订单模块功能"
          />
          <button className="send-button" type="submit">
            <Send size={16} />
            发送
          </button>
        </form>
      </main>
    </div>
  );
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `src/ui/styles.css`:

```css
:root {
  color: #2e2b27;
  background: #f4f1eb;
  font-family:
    "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 960px;
  min-height: 100vh;
  background: #f4f1eb;
}

button,
textarea {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  height: 100vh;
  background: #f4f1eb;
}

.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #ded8ce;
  background: #ebe7df;
  padding: 14px;
}

.sidebar-header {
  display: grid;
  gap: 12px;
}

.app-title {
  font-size: 15px;
  font-weight: 650;
}

.new-test-button,
.settings-button,
.session-item,
.send-button {
  align-items: center;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
}

.new-test-button {
  background: #3d6f8f;
  color: #fff;
  justify-content: center;
  padding: 10px 12px;
}

.session-list {
  display: grid;
  gap: 4px;
  margin-top: 18px;
}

.session-item {
  background: transparent;
  color: #514c45;
  justify-content: flex-start;
  padding: 9px 10px;
  text-align: left;
}

.session-item.active {
  background: #ddd7ce;
  color: #1f1d1a;
}

.settings-button {
  background: transparent;
  color: #615a51;
  margin-top: auto;
  padding: 9px 10px;
}

.conversation {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-width: 0;
  padding: 22px 28px;
}

.conversation-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.eyebrow {
  color: #82796d;
  font-size: 12px;
  margin: 0 0 4px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 19px;
}

.status-chip {
  background: #e2ded7;
  border-radius: 999px;
  color: #625b52;
  font-size: 12px;
  padding: 5px 10px;
}

.empty-state {
  align-self: center;
  color: #514c45;
  display: grid;
  gap: 8px;
  justify-self: center;
  max-width: 520px;
  text-align: center;
}

.empty-state h2 {
  font-size: 20px;
  font-weight: 580;
}

.empty-state p {
  color: #82796d;
}

.composer {
  align-items: flex-end;
  background: #fffdfa;
  border: 1px solid #ded8ce;
  border-radius: 12px;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 12px;
}

.composer textarea {
  background: transparent;
  border: 0;
  color: #2e2b27;
  min-height: 48px;
  outline: 0;
  resize: none;
}

.send-button {
  background: #2f6f8f;
  color: #fff;
  padding: 9px 12px;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/app/App.tsx src/app/App.test.tsx src/ui/styles.css
git commit -m "feat: add conversation app shell"
```

Expected: commit created.

## Task 7: Natural Language Submit And Plan Rendering

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing interaction test**

Append to `src/app/App.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";

it("turns a Chinese prompt into a plan awaiting confirmation", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText("测试目标"), "测试订单模块功能");
  await user.click(screen.getByRole("button", { name: "发送" }));

  expect(await screen.findByText("测试订单模块功能")).toBeInTheDocument();
  expect(await screen.findByText("我将基于订单模块的测试工具生成执行计划。")).toBeInTheDocument();
  expect(await screen.findByText("测试计划")).toBeInTheDocument();
  expect(screen.getByText("登录测试账号")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开始执行" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "调整计划" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: FAIL because submitting the form does not render messages or a plan.

- [ ] **Step 3: Implement prompt submission and plan card**

Replace `src/app/App.tsx` with:

```tsx
import { FormEvent, useState } from "react";
import { Plus, Send, Settings } from "lucide-react";
import { applyRunEvent, createInitialRun, type TestRun } from "../domain/testRun";
import "../ui/styles.css";

const sessions = ["订单模块测试", "支付回归", "优惠券异常"];

export function App() {
  const [prompt, setPrompt] = useState("");
  const [run, setRun] = useState<TestRun | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const initialRun = createInitialRun({
      prompt: trimmed,
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });
    const plannedRun = applyRunEvent(applyRunEvent(initialRun, { type: "run:planning" }), {
      type: "run:plan-ready",
      plan: [
        { id: "plan-login", title: "登录测试账号", status: "pending" },
        { id: "plan-create-order", title: "创建测试订单", status: "pending" },
        { id: "plan-update-order", title: "修改订单信息", status: "pending" },
        { id: "plan-check-status", title: "校验订单状态", status: "pending" },
      ],
    });

    setRun(plannedRun);
    setPrompt("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="会话列表">
        <div className="sidebar-header">
          <div className="app-title">AI 测试助手</div>
          <button className="new-test-button" type="button">
            <Plus size={16} />
            新建测试
          </button>
        </div>
        <nav className="session-list" aria-label="最近会话">
          {sessions.map((session, index) => (
            <button
              className={index === 0 ? "session-item active" : "session-item"}
              key={session}
              type="button"
            >
              {session}
            </button>
          ))}
        </nav>
        <button className="settings-button" type="button">
          <Settings size={16} />
          设置
        </button>
      </aside>
      <main className="conversation" aria-label="测试对话">
        <header className="conversation-header">
          <div>
            <p className="eyebrow">当前会话</p>
            <h1>订单模块测试</h1>
          </div>
          <span className="status-chip">{run ? "等待确认" : "空闲"}</span>
        </header>
        <section className="message-stream" aria-label="消息流">
          {run ? (
            <>
              <article className="message user-message">{run.userPrompt}</article>
              <article className="message ai-message">
                <p>我将基于订单模块的测试工具生成执行计划。</p>
                <div className="plan-card">
                  <h2>测试计划</h2>
                  <ol>
                    {run.plan.map((step) => (
                      <li key={step.id}>{step.title}</li>
                    ))}
                  </ol>
                  <div className="action-row">
                    <button className="primary-action" type="button">
                      开始执行
                    </button>
                    <button className="secondary-action" type="button">
                      调整计划
                    </button>
                  </div>
                </div>
              </article>
            </>
          ) : (
            <section className="empty-state">
              <h2>输入测试目标，AI 会生成计划并调用 MCP 工具执行。</h2>
              <p>例如：测试订单模块功能</p>
            </section>
          )}
        </section>
        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            aria-label="测试目标"
            onChange={(event) => setPrompt(event.currentTarget.value)}
            placeholder="输入你想测试的功能，例如：测试订单模块功能"
            value={prompt}
          />
          <button className="send-button" type="submit">
            <Send size={16} />
            发送
          </button>
        </form>
      </main>
    </div>
  );
}
```

Append to `src/ui/styles.css`:

```css
.message-stream {
  align-content: start;
  display: grid;
  gap: 18px;
  overflow: auto;
  padding: 36px 0;
}

.message {
  border-radius: 10px;
  max-width: 760px;
  padding: 14px 16px;
}

.user-message {
  background: #fffdfa;
  border: 1px solid #ded8ce;
  justify-self: end;
}

.ai-message {
  display: grid;
  gap: 14px;
  justify-self: start;
}

.plan-card {
  background: #fffdfa;
  border: 1px solid #ded8ce;
  border-radius: 10px;
  display: grid;
  gap: 12px;
  padding: 14px;
}

.plan-card h2 {
  font-size: 15px;
}

.plan-card ol {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
}

.action-row {
  display: flex;
  gap: 8px;
}

.primary-action,
.secondary-action {
  border-radius: 8px;
  cursor: pointer;
  padding: 8px 12px;
}

.primary-action {
  background: #2f6f8f;
  border: 1px solid #2f6f8f;
  color: #fff;
}

.secondary-action {
  background: #fffdfa;
  border: 1px solid #d3cdc3;
  color: #514c45;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/ui/styles.css
git commit -m "feat: render generated test plan"
```

Expected: commit created.

## Task 8: Execute Plan And Render MCP Tool Events

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Write failing execution test**

Append to `src/app/App.test.tsx`:

```tsx
it("shows MCP tool events after the tester starts execution", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText("测试目标"), "测试订单模块功能");
  await user.click(screen.getByRole("button", { name: "发送" }));
  await user.click(await screen.findByRole("button", { name: "开始执行" }));

  expect(await screen.findByText("MCP 工具调用")).toBeInTheDocument();
  expect(screen.getByText("mcp-user.login")).toBeInTheDocument();
  expect(screen.getByText("测试账号登录成功")).toBeInTheDocument();
  expect(screen.getByText("AI 请求查询订单数据库")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "允许" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "拒绝" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: FAIL because clicking `开始执行` does not render MCP tool events.

- [ ] **Step 3: Implement execution click and tool event rendering**

Modify `src/app/App.tsx`:

```tsx
import { FormEvent, useState } from "react";
import { Plus, Send, Settings } from "lucide-react";
import {
  applyRunEvent,
  createInitialRun,
  type TestRun,
  type ToolCall,
} from "../domain/testRun";
import "../ui/styles.css";

const sessions = ["订单模块测试", "支付回归", "优惠券异常"];

export function App() {
  const [prompt, setPrompt] = useState("");
  const [run, setRun] = useState<TestRun | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const initialRun = createInitialRun({
      prompt: trimmed,
      projectName: "电商后台",
      environmentName: "QA",
      agentName: "订单测试 Agent",
    });
    const plannedRun = applyRunEvent(applyRunEvent(initialRun, { type: "run:planning" }), {
      type: "run:plan-ready",
      plan: [
        { id: "plan-login", title: "登录测试账号", status: "pending" },
        { id: "plan-create-order", title: "创建测试订单", status: "pending" },
        { id: "plan-update-order", title: "修改订单信息", status: "pending" },
        { id: "plan-check-status", title: "校验订单状态", status: "pending" },
      ],
    });

    setRun(plannedRun);
    setPrompt("");
  }

  function handleStartExecution() {
    if (!run) return;

    let nextRun = applyRunEvent(run, { type: "run:status-changed", status: "running" });
    nextRun = applyRunEvent(nextRun, {
      type: "tool:call-started",
      toolCall: {
        id: "tool-login",
        toolName: "mcp-user.login",
        label: "登录测试账号",
        status: "running",
      },
    });
    nextRun = applyRunEvent(nextRun, {
      type: "tool:call-completed",
      toolCallId: "tool-login",
      outputSummary: "测试账号登录成功",
    });
    nextRun = applyRunEvent(nextRun, {
      type: "tool:approval-required",
      toolCall: {
        id: "tool-query-order",
        toolName: "mcp-db.queryOrder",
        label: "查询订单数据库",
        status: "waiting_approval",
        approvalReason: "AI 请求查询订单数据库",
      },
    });

    setRun(nextRun);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="会话列表">
        <div className="sidebar-header">
          <div className="app-title">AI 测试助手</div>
          <button className="new-test-button" type="button">
            <Plus size={16} />
            新建测试
          </button>
        </div>
        <nav className="session-list" aria-label="最近会话">
          {sessions.map((session, index) => (
            <button
              className={index === 0 ? "session-item active" : "session-item"}
              key={session}
              type="button"
            >
              {session}
            </button>
          ))}
        </nav>
        <button className="settings-button" type="button">
          <Settings size={16} />
          设置
        </button>
      </aside>
      <main className="conversation" aria-label="测试对话">
        <header className="conversation-header">
          <div>
            <p className="eyebrow">当前会话</p>
            <h1>订单模块测试</h1>
          </div>
          <span className="status-chip">{getStatusLabel(run?.status ?? "idle")}</span>
        </header>
        <section className="message-stream" aria-label="消息流">
          {run ? (
            <>
              <article className="message user-message">{run.userPrompt}</article>
              <article className="message ai-message">
                <p>我将基于订单模块的测试工具生成执行计划。</p>
                <div className="plan-card">
                  <h2>测试计划</h2>
                  <ol>
                    {run.plan.map((step) => (
                      <li key={step.id}>{step.title}</li>
                    ))}
                  </ol>
                  {run.status === "waiting_confirmation" ? (
                    <div className="action-row">
                      <button className="primary-action" onClick={handleStartExecution} type="button">
                        开始执行
                      </button>
                      <button className="secondary-action" type="button">
                        调整计划
                      </button>
                    </div>
                  ) : null}
                </div>
                {run.toolCalls.length > 0 ? <ToolCallList toolCalls={run.toolCalls} /> : null}
              </article>
            </>
          ) : (
            <section className="empty-state">
              <h2>输入测试目标，AI 会生成计划并调用 MCP 工具执行。</h2>
              <p>例如：测试订单模块功能</p>
            </section>
          )}
        </section>
        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            aria-label="测试目标"
            onChange={(event) => setPrompt(event.currentTarget.value)}
            placeholder="输入你想测试的功能，例如：测试订单模块功能"
            value={prompt}
          />
          <button className="send-button" type="submit">
            <Send size={16} />
            发送
          </button>
        </form>
      </main>
    </div>
  );
}

function ToolCallList({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <section className="tool-call-list" aria-label="MCP 工具调用">
      <h2>MCP 工具调用</h2>
      {toolCalls.map((toolCall) => (
        <div className="tool-call-row" key={toolCall.id}>
          <span className="tool-name">{toolCall.toolName}</span>
          <span>{toolCall.label}</span>
          <span className={`tool-status ${toolCall.status}`}>{getToolStatusLabel(toolCall.status)}</span>
          {toolCall.outputSummary ? <span>{toolCall.outputSummary}</span> : null}
          {toolCall.approvalReason ? (
            <div className="approval-box">
              <span>{toolCall.approvalReason}</span>
              <button type="button">允许</button>
              <button type="button">拒绝</button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function getStatusLabel(status: TestRun["status"]) {
  const labels: Record<TestRun["status"], string> = {
    idle: "空闲",
    planning: "正在生成计划",
    waiting_confirmation: "等待确认",
    running: "正在执行",
    waiting_approval: "等待授权",
    completed: "已完成",
    failed: "失败",
    blocked: "已阻塞",
    stopped: "已停止",
  };
  return labels[status];
}

function getToolStatusLabel(status: ToolCall["status"]) {
  const labels: Record<ToolCall["status"], string> = {
    pending: "待执行",
    running: "执行中",
    waiting_approval: "待授权",
    completed: "已完成",
    failed: "失败",
    skipped: "已跳过",
  };
  return labels[status];
}
```

Append to `src/ui/styles.css`:

```css
.tool-call-list {
  background: #f7f4ef;
  border: 1px solid #ded8ce;
  border-radius: 10px;
  display: grid;
  gap: 8px;
  padding: 12px;
}

.tool-call-list h2 {
  font-size: 14px;
}

.tool-call-row {
  align-items: center;
  background: #fffdfa;
  border: 1px solid #e7e1d8;
  border-radius: 8px;
  display: grid;
  gap: 8px;
  grid-template-columns: 180px 1fr auto;
  padding: 9px 10px;
}

.tool-name {
  color: #625b52;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
}

.tool-status {
  border-radius: 999px;
  font-size: 12px;
  padding: 4px 8px;
}

.tool-status.running {
  background: #e5f0f6;
  color: #27637f;
}

.tool-status.completed {
  background: #e6f2e7;
  color: #2f6f3a;
}

.tool-status.waiting_approval {
  background: #f8ecd0;
  color: #7c5a19;
}

.approval-box {
  align-items: center;
  display: flex;
  gap: 8px;
  grid-column: 1 / -1;
}

.approval-box button {
  background: #fffdfa;
  border: 1px solid #d3cdc3;
  border-radius: 7px;
  cursor: pointer;
  padding: 6px 10px;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/ui/styles.css
git commit -m "feat: render mcp execution events"
```

Expected: commit created.

## Task 9: Approval, Evidence, And Bug Draft Drawer

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Write failing approval and drawer test**

Append to `src/app/App.test.tsx`:

```tsx
it("creates evidence and a bug draft after database approval", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText("测试目标"), "测试订单模块功能");
  await user.click(screen.getByRole("button", { name: "发送" }));
  await user.click(await screen.findByRole("button", { name: "开始执行" }));
  await user.click(await screen.findByRole("button", { name: "允许" }));

  expect(await screen.findByText("订单状态接口响应")).toBeInTheDocument();
  expect(screen.getByText("订单取消后状态未同步")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成缺陷草稿" })).toBeInTheDocument();
  expect(screen.getByText("严重级别：P1")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: FAIL because approval does not create evidence or bug draft.

- [ ] **Step 3: Implement approval side effects and details drawer**

In `src/app/App.tsx`, add a `handleApproveTool` function and render evidence/draft when present:

```tsx
function handleApproveTool() {
  if (!run) return;

  let nextRun = applyRunEvent(run, {
    type: "tool:call-completed",
    toolCallId: "tool-query-order",
    outputSummary: "订单状态为待支付，和预期不一致",
  });
  nextRun = applyRunEvent(nextRun, {
    type: "evidence:created",
    evidence: {
      id: "ev-order-status",
      type: "api_response",
      title: "订单状态接口响应",
      summary: "取消订单后接口仍返回待支付",
    },
  });
  nextRun = applyRunEvent(nextRun, {
    type: "bug-draft:created",
    bugDraft: {
      title: "订单取消后状态未同步",
      severity: "P1",
      steps: ["登录测试账号", "创建测试订单", "取消订单", "查询订单状态"],
      expected: "订单状态为已取消",
      actual: "订单状态仍为待支付",
      evidenceIds: ["ev-order-status"],
    },
  });
  nextRun = applyRunEvent(nextRun, { type: "run:status-changed", status: "failed" });
  setRun(nextRun);
}
```

Change the `允许` button inside `ToolCallList` so it receives and calls `onApprove`:

```tsx
{run.toolCalls.length > 0 ? (
  <ToolCallList onApprove={handleApproveTool} toolCalls={run.toolCalls} />
) : null}
```

Use this component signature and button:

```tsx
function ToolCallList({
  onApprove,
  toolCalls,
}: {
  onApprove: () => void;
  toolCalls: ToolCall[];
}) {
  return (
    <section className="tool-call-list" aria-label="MCP 工具调用">
      <h2>MCP 工具调用</h2>
      {toolCalls.map((toolCall) => (
        <div className="tool-call-row" key={toolCall.id}>
          <span className="tool-name">{toolCall.toolName}</span>
          <span>{toolCall.label}</span>
          <span className={`tool-status ${toolCall.status}`}>{getToolStatusLabel(toolCall.status)}</span>
          {toolCall.outputSummary ? <span>{toolCall.outputSummary}</span> : null}
          {toolCall.approvalReason && toolCall.status === "waiting_approval" ? (
            <div className="approval-box">
              <span>{toolCall.approvalReason}</span>
              <button onClick={onApprove} type="button">允许</button>
              <button type="button">拒绝</button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
```

After `ToolCallList`, render:

```tsx
{run.evidence.length > 0 || run.bugDraft ? (
  <aside className="details-drawer" aria-label="本次测试">
    <h2>本次测试</h2>
    <dl>
      <div><dt>当前项目</dt><dd>{run.projectName}</dd></div>
      <div><dt>环境</dt><dd>{run.environmentName}</dd></div>
      <div><dt>Agent</dt><dd>{run.agentName}</dd></div>
      <div><dt>MCP 工具</dt><dd>{run.toolCalls.length} 个</dd></div>
      <div><dt>证据</dt><dd>{run.evidence.length} 张</dd></div>
    </dl>
    {run.evidence.map((evidence) => (
      <div className="evidence-card" key={evidence.id}>
        <strong>{evidence.title}</strong>
        <span>{evidence.summary}</span>
      </div>
    ))}
    {run.bugDraft ? (
      <div className="bug-draft-card">
        <h3>{run.bugDraft.title}</h3>
        <p>严重级别：{run.bugDraft.severity}</p>
        <p>实际结果：{run.bugDraft.actual}</p>
        <button type="button">生成缺陷草稿</button>
      </div>
    ) : null}
  </aside>
) : null}
```

Append to `src/ui/styles.css`:

```css
.details-drawer {
  background: #fffdfa;
  border: 1px solid #ded8ce;
  border-radius: 10px;
  display: grid;
  gap: 12px;
  margin-top: 8px;
  padding: 14px;
}

.details-drawer h2 {
  font-size: 15px;
}

.details-drawer dl {
  display: grid;
  gap: 7px;
  margin: 0;
}

.details-drawer dl div {
  display: flex;
  justify-content: space-between;
}

.details-drawer dt {
  color: #82796d;
}

.details-drawer dd {
  margin: 0;
}

.evidence-card,
.bug-draft-card {
  background: #f7f4ef;
  border: 1px solid #e7e1d8;
  border-radius: 8px;
  display: grid;
  gap: 6px;
  padding: 10px;
}

.bug-draft-card h3 {
  font-size: 15px;
  margin: 0;
}

.bug-draft-card button {
  background: #2f6f8f;
  border: 0;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  padding: 8px 10px;
  width: fit-content;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/ui/styles.css
git commit -m "feat: add approval evidence and bug draft flow"
```

Expected: commit created.

## Task 10: Electron Main And Preload Bridge

**Files:**
- Create: `electron/preload.ts`
- Create: `electron/main.ts`
- Create: `electron/preload.test.ts`

- [ ] **Step 1: Write failing preload test**

Create `electron/preload.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createSafeIpcApi } from "./preload";

describe("createSafeIpcApi", () => {
  it("sends only allowlisted renderer channels", () => {
    const send = vi.fn();
    const api = createSafeIpcApi({ send });

    api.send("run:create", { prompt: "测试订单模块功能" });

    expect(send).toHaveBeenCalledWith("run:create", { prompt: "测试订单模块功能" });
    expect(() => api.send("shell:openExternal", {})).toThrow("Unsupported IPC channel");
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- electron/preload.test.ts
```

Expected: FAIL because `electron/preload.ts` does not exist.

- [ ] **Step 3: Implement preload helper and Electron bootstrap**

Create `electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";
import { isRendererToMainChannel, type RendererToMainChannel } from "../src/ipc/channels";

type IpcSender = {
  send: (channel: string, payload: unknown) => void;
};

export function createSafeIpcApi(sender: IpcSender) {
  return {
    send(channel: string, payload: unknown) {
      if (!isRendererToMainChannel(channel)) {
        throw new Error("Unsupported IPC channel");
      }
      sender.send(channel, payload);
    },
  };
}

declare global {
  interface Window {
    aiTestAssistant?: {
      send: (channel: RendererToMainChannel, payload: unknown) => void;
    };
  }
}

if (typeof contextBridge !== "undefined") {
  contextBridge.exposeInMainWorld("aiTestAssistant", createSafeIpcApi(ipcRenderer));
}
```

Create `electron/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "AI 测试助手",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- electron/preload.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/main.ts electron/preload.ts electron/preload.test.ts
git commit -m "feat: add electron shell and safe ipc bridge"
```

Expected: commit created.

## Task 11: End-To-End Browser Flow

**Files:**
- Create: `tests/e2e/ai-test-flow.spec.ts`

- [ ] **Step 1: Write failing e2e test**

Create `tests/e2e/ai-test-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("tester can submit an order module request and approve MCP access", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("测试目标").fill("测试订单模块功能");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("测试计划")).toBeVisible();
  await page.getByRole("button", { name: "开始执行" }).click();

  await expect(page.getByText("mcp-user.login")).toBeVisible();
  await expect(page.getByText("AI 请求查询订单数据库")).toBeVisible();
  await page.getByRole("button", { name: "允许" }).click();

  await expect(page.getByText("订单状态接口响应")).toBeVisible();
  await expect(page.getByText("订单取消后状态未同步")).toBeVisible();
  await expect(page.getByRole("button", { name: "生成缺陷草稿" })).toBeVisible();
});
```

- [ ] **Step 2: Run e2e test to verify current behavior**

Run:

```bash
npm run e2e -- tests/e2e/ai-test-flow.spec.ts
```

Expected: PASS if previous tasks are complete. If it fails, the failure should identify a real integration gap in the UI flow; fix the production code only after adding or keeping the failing e2e assertion.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
npm run e2e
```

Expected: all tests pass with no warnings.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/ai-test-flow.spec.ts
git commit -m "test: cover ai testing flow end to end"
```

Expected: commit created.

## Task 12: Final Build Verification

**Files:**
- Modify only if tests reveal a defect.

- [ ] **Step 1: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 2: Run all verification**

Run:

```bash
npm test
npm run e2e
```

Expected: all unit, component, and e2e tests pass.

- [ ] **Step 3: Manual visual check**

Run:

```bash
npm run dev
```

Open: `http://127.0.0.1:5173`

Check:

- Left side is a narrow conversation list, not a dashboard.
- Center is a message stream with a bottom composer.
- Input placeholder is Chinese.
- Tool events appear inside the AI message context.
- Approval prompt appears inline.
- Evidence and bug draft appear only after approval.
- Styling is calm, warm, and close to Claude Desktop rather than an enterprise console.

- [ ] **Step 4: Commit final fixes if any**

```bash
git add .
git commit -m "fix: polish ai test assistant verification gaps"
```

Expected: commit created only if files changed during final verification.

## Self-Review

Spec coverage:

- Chinese natural-language input: Tasks 6 and 7.
- Claude Desktop style left sidebar, message stream, composer: Tasks 6 and 7.
- AI plan generation and confirmation: Tasks 3, 4, 7.
- MCP tool execution chain: Tasks 3, 4, 8.
- Approval gate for sensitive tool calls: Tasks 3, 8, 9.
- Evidence and bug draft: Tasks 3 and 9.
- Electron renderer/main boundary and IPC allowlist: Tasks 5 and 10.
- TDD requirement: every behavior task starts with a failing test and expected RED result.

Placeholder scan:

- No task uses placeholder markers or unspecified implementation language.
- Each code-producing step includes concrete file paths and code.

Type consistency:

- `RunStatus`, `ToolCallStatus`, `TestRun`, `ToolCall`, `Evidence`, and `BugDraft` match the design spec.
- IPC channel names match the design spec.
- UI status labels map all `RunStatus` values.
