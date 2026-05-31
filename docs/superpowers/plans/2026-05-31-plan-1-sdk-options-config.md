# Plan 1: SDK Options 补全与配置层改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 27 个 SDK 配置项、2 个权限模式、3 个 alpha 函数、2 个 UI 控件补全到项目中，无新增 IPC 通道。

**Architecture:** 分层改造——sdkSettings.ts 新增 resolveSettings 调用链 → agentConfig.ts 扩展类型和校验 → facade 新增 re-export → SettingsPanel 新增控件。所有变更使用 TDD。

**Tech Stack:** TypeScript, Vitest, React 19, @anthropic-ai/claude-agent-sdk v0.3.150

---

### Task 1: 扩展 SettingsFormValues 类型

**Files:**
- Modify: `electron/agent/sdkSettings.ts`

- [ ] **Step 1: 写失败测试**

在 `electron/agent/sdkSettings.test.ts` 中新增：

```typescript
import { describe, expect, it } from "vitest";
import { SettingsFormValues } from "./sdkSettings.js";

describe("SettingsFormValues", () => {
  it("accepts effort and sandboxEnabled optional fields", () => {
    const valid: SettingsFormValues = {
      baseUrl: "https://gateway.example.com",
      apiKey: "sk-test",
      model: "claude-sonnet-4",
      effort: "high",
      sandboxEnabled: true,
    };
    expect(valid.effort).toBe("high");
    expect(valid.sandboxEnabled).toBe(true);
  });

  it("allows omitting new fields for backward compatibility", () => {
    const minimal: SettingsFormValues = {
      baseUrl: "",
      apiKey: "",
      model: "",
    };
    expect(minimal.effort).toBeUndefined();
    expect(minimal.sandboxEnabled).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/sdkSettings.test.ts
```

预期：TypeScript 编译失败，因为 `SettingsFormValues` 没有 `effort` 和 `sandboxEnabled` 字段。

- [ ] **Step 3: 扩展类型**

```typescript
// electron/agent/sdkSettings.ts
export type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
  // 新增
  effort?: string;          // low | medium | high | xhigh | max
  sandboxEnabled?: boolean; // 沙箱是否启用
};
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/sdkSettings.test.ts
```

预期：PASS。

- [ ] **Step 5: 提交**

```bash
git add electron/agent/sdkSettings.ts electron/agent/sdkSettings.test.ts
git commit -m "feat: 扩展 SettingsFormValues 支持 effort 和 sandboxEnabled"
```

---

### Task 2: saveClaudeCodeSettings 支持新字段持久化

**Files:**
- Modify: `electron/agent/sdkSettings.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// sdkSettings.test.ts 新增
it("saveClaudeCodeSettings persists effort and sandboxEnabled", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
  const cwd = path.join(tmp, "project");
  fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });

  try {
    saveClaudeCodeSettings({
      cwd,
      baseUrl: "https://gw.example.com",
      apiKey: "sk-test",
      model: "claude-sonnet-4",
      effort: "max",
      sandboxEnabled: true,
    });

    const loaded = loadClaudeCodeSettings({ cwd });
    expect(loaded.effort).toBe("max");
    expect(loaded.sandboxEnabled).toBe(true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/sdkSettings.test.ts
```

- [ ] **Step 3: 修改 saveClaudeCodeSettings**

```typescript
// electron/agent/sdkSettings.ts — saveClaudeCodeSettings 函数
export function saveClaudeCodeSettings(input: SettingsFormValues & { cwd: string }): NativeClaudeCodeSettings {
  // ... 现有逻辑不变 ...

  const settings: NativeClaudeCodeSettings = {
    ...existing,
    env: {
      ...(existing.env ?? {}),
      ANTHROPIC_BASE_URL: input.baseUrl.trim(),
      ANTHROPIC_AUTH_TOKEN: input.apiKey.trim(),
      ANTHROPIC_MODEL: input.model.trim(),
      // 新增：非 Anthropic 原生字段存入 settings 顶层
      ...(input.effort ? { CLAUDE_CODE_EFFORT: input.effort } : {}),
      ...(input.sandboxEnabled !== undefined ? { CLAUDE_CODE_SANDBOX_ENABLED: String(input.sandboxEnabled) } : {}),
    },
  };

  // ... 其余不变 ...
}
```

同时修改 `loadClaudeCodeSettings` 读取新字段：

```typescript
export function loadClaudeCodeSettings({ cwd }: { cwd: string }): SettingsFormValues {
  const shared = readNativeSettings(settingsPathForCwd(cwd));
  const local = readNativeSettings(settingsLocalPathForCwd(cwd));
  return {
    baseUrl: stringValue(local.env?.ANTHROPIC_BASE_URL ?? shared.env?.ANTHROPIC_BASE_URL),
    apiKey: stringValue(local.env?.ANTHROPIC_AUTH_TOKEN ?? shared.env?.ANTHROPIC_AUTH_TOKEN),
    model: stringValue(local.env?.ANTHROPIC_MODEL ?? shared.env?.ANTHROPIC_MODEL),
    effort: stringValue(local.env?.CLAUDE_CODE_EFFORT ?? shared.env?.CLAUDE_CODE_EFFORT) || undefined,
    sandboxEnabled: (local.env?.CLAUDE_CODE_SANDBOX_ENABLED ?? shared.env?.CLAUDE_CODE_SANDBOX_ENABLED) === "true" ? true : undefined,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/sdkSettings.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/sdkSettings.ts electron/agent/sdkSettings.test.ts
git commit -m "feat: saveClaudeCodeSettings/loadClaudeCodeSettings 支持 effort 和 sandbox"
```

---

### Task 3: facade 导出 foldSessionSummary

**Files:**
- Modify: `electron/agent/claudeAgentSdkFacade.ts`

- [ ] **Step 1: 新增导出并验证**

```typescript
// electron/agent/claudeAgentSdkFacade.ts
export * from "@anthropic-ai/claude-agent-sdk";

// 新增
export { foldSessionSummary } from "@anthropic-ai/claude-agent-sdk";
```

- [ ] **Step 2: 写验证测试**

```typescript
// claudeAgentSdkFacade.test.ts 新增
import { foldSessionSummary } from "./claudeAgentSdkFacade.js";

it("foldSessionSummary is exported and is a function", () => {
  expect(typeof foldSessionSummary).toBe("function");
});
```

- [ ] **Step 3: 运行测试**

```bash
npm test -- electron/agent/claudeAgentSdkFacade.test.ts
```

- [ ] **Step 4: 提交**

```bash
git add electron/agent/claudeAgentSdkFacade.ts electron/agent/claudeAgentSdkFacade.test.ts
git commit -m "feat: facade 导出 foldSessionSummary"
```

---

### Task 4: sdkSettings.ts 新增 loadResolvedSettings 和 filterEscalatingMode

**Files:**
- Modify: `electron/agent/sdkSettings.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// sdkSettings.test.ts 新增
import { loadResolvedSettings, filterEscalatingMode } from "./sdkSettings.js";

describe("loadResolvedSettings", () => {
  it("returns effective settings and provenance for valid cwd", async () => {
    const result = await loadResolvedSettings(process.cwd());
    expect(result).toHaveProperty("effective");
    expect(result).toHaveProperty("provenance");
    expect(typeof result.effective).toBe("object");
  });

  it("falls back to loadClaudeCodeSettings on SDK failure", async () => {
    // 临时修改 cwd 到不存在的目录触发回退
    const result = await loadResolvedSettings("/nonexistent/path");
    expect(result).toHaveProperty("effective");
    expect(result.provenance).toEqual({});
  });
});

describe("filterEscalatingMode", () => {
  it("is a function", () => {
    expect(typeof filterEscalatingMode).toBe("function");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/sdkSettings.test.ts
```

- [ ] **Step 3: 实现 loadResolvedSettings 和 filterEscalatingMode**

```typescript
// electron/agent/sdkSettings.ts 新增
import { resolveSettings, filterEscalatingDefaultMode } from "./claudeAgentSdkFacade.js";
import type { ResolvedSettings, Settings } from "./claudeAgentSdkFacade.js";

export async function loadResolvedSettings(cwd: string): Promise<{
  effective: Settings;
  provenance: Record<string, { source: string; path?: string }>;
}> {
  try {
    const resolved: ResolvedSettings = await resolveSettings({ cwd });
    const safe = filterEscalatingDefaultMode(resolved);
    return {
      effective: safe,
      provenance: (resolved.provenance ?? {}) as Record<string, { source: string; path?: string }>,
    };
  } catch (error) {
    console.warn("resolveSettings failed, falling back to manual merge:", error);
    // 回退：构建最小 effective 对象
    const manual = loadClaudeCodeSettings({ cwd });
    return {
      effective: {
        env: {
          ANTHROPIC_BASE_URL: manual.baseUrl,
          ANTHROPIC_AUTH_TOKEN: manual.apiKey,
          ANTHROPIC_MODEL: manual.model,
        },
      } as Settings,
      provenance: {},
    };
  }
}

export function filterEscalatingMode(resolved: ResolvedSettings): Settings {
  return filterEscalatingDefaultMode(resolved);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/sdkSettings.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/sdkSettings.ts electron/agent/sdkSettings.test.ts
git commit -m "feat: 新增 loadResolvedSettings 和 filterEscalatingMode"
```

---

### Task 5: 扩展 UserSdkOptions 类型（A 组：白名单 Set 校验 5 个）

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 扩展类型定义**

```typescript
// electron/agent/agentConfig.ts — UserSdkOptions 类型

type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | "auto";
type ThinkingEffort = "low" | "medium" | "high" | "xhigh" | "max";
type ThinkingDisplay = "summarized" | "omitted";
type Executable = "bun" | "deno" | "node";
type SessionStoreFlushValue = "batched" | "eager";
type SettingSourceValue = "user" | "project" | "local";

export type UserSdkOptions = {
  permissionMode?: PermissionMode;
  maxTurns?: number;
  additionalDirectories?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  agents?: Record<string, unknown>;
  skills?: Record<string, unknown> | string[];
  hooks?: Record<string, unknown>;
  tools?: unknown[];
  mcpServers?: Record<string, unknown>;
  systemPrompt?: string;
  thinking?: { effort?: ThinkingEffort; display?: ThinkingDisplay };
  toolChoice?: unknown;
  outputConfig?: unknown;
  contextEditing?: unknown;
  compaction?: unknown;
  promptCaching?: unknown;
  // ===== A 组：白名单 Set 校验 =====
  effort?: ThinkingEffort;
  executable?: Executable;
  sessionStoreFlush?: SessionStoreFlushValue;
  betas?: string[];
  settingSources?: SettingSourceValue[];
  // ===== B 组：类型守卫校验（先声明，校验在后续 task 实现）=====
  title?: string;
  debug?: boolean;
  debugFile?: string;
  strictMcpConfig?: boolean;
  persistSession?: boolean;
  includeHookEvents?: boolean;
  forwardSubagentText?: boolean;
  promptSuggestions?: boolean;
  agentProgressSummaries?: boolean;
  allowDangerouslySkipPermissions?: boolean;
  planModeInstructions?: string;
  permissionPromptToolName?: string;
  // ===== C 组：结构校验 =====
  toolConfig?: { askUserQuestion?: { previewFormat?: "markdown" | "html" } };
  sandbox?: { enabled?: boolean; network?: unknown; filesystem?: unknown; [k: string]: unknown };
  plugins?: Array<{ type: "local"; path: string; [k: string]: unknown }>;
  managedSettings?: Record<string, unknown>;
  settings?: string | Record<string, unknown>;
  toolAliases?: Record<string, string>;
  agent?: string;
  extraArgs?: Record<string, string | null>;
  executableArgs?: string[];
  resumeSessionAt?: string;
};
```

- [ ] **Step 2: 写测试验证类型**

```typescript
// agentConfig.test.ts 新增
it("UserSdkOptions accepts effort field", () => {
  const opts: UserSdkOptions = { effort: "high" };
  expect(opts.effort).toBe("high");
});

it("UserSdkOptions accepts settingSources as array", () => {
  const opts: UserSdkOptions = { settingSources: ["user", "project"] };
  expect(opts.settingSources).toEqual(["user", "project"]);
});
```

- [ ] **Step 3: 运行 tsc 确认类型编译通过**

```bash
npx tsc -p tsconfig.node.json --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: UserSdkOptions 扩展 A 组字段（effort/executable/betas 等）"
```

---

### Task 6: 补全 sanitizeUserSdkOptions（A 组白名单校验）

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// agentConfig.test.ts 新增
import { sanitizeUserSdkOptions } from "./agentConfig.js"; // 如果未导出需先导出

describe("sanitizeUserSdkOptions A 组", () => {
  it("accepts valid effort values", () => {
    expect(sanitizeUserSdkOptions({ effort: "low" })).toHaveProperty("effort", "low");
    expect(sanitizeUserSdkOptions({ effort: "high" })).toHaveProperty("effort", "high");
    expect(sanitizeUserSdkOptions({ effort: "max" })).toHaveProperty("effort", "max");
  });

  it("rejects invalid effort values", () => {
    expect(sanitizeUserSdkOptions({ effort: "invalid" })).not.toHaveProperty("effort");
    expect(sanitizeUserSdkOptions({ effort: 123 })).not.toHaveProperty("effort");
  });

  it("accepts valid executable values", () => {
    expect(sanitizeUserSdkOptions({ executable: "node" })).toHaveProperty("executable", "node");
    expect(sanitizeUserSdkOptions({ executable: "bun" })).toHaveProperty("executable", "bun");
  });

  it("accepts valid betas array", () => {
    expect(sanitizeUserSdkOptions({ betas: ["context-1m-2025-08-07"] }))
      .toHaveProperty("betas", ["context-1m-2025-08-07"]);
    expect(sanitizeUserSdkOptions({ betas: ["invalid-beta"] }))
      .toHaveProperty("betas", []); // 非法值被过滤
  });

  it("accepts valid settingSources array", () => {
    expect(sanitizeUserSdkOptions({ settingSources: ["user", "project"] }))
      .toHaveProperty("settingSources", ["user", "project"]);
    expect(sanitizeUserSdkOptions({ settingSources: ["invalid"] }))
      .toHaveProperty("settingSources", []); // 非法值被过滤
  });
});
```

- [ ] **Step 2: 先导出 sanitizeUserSdkOptions**

```typescript
// agentConfig.ts — 将函数改为 export
export function sanitizeUserSdkOptions(input: unknown): UserSdkOptions {
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 4: 实现 A 组校验**

```typescript
// agentConfig.ts — sanitizeUserSdkOptions 函数内新增

const effortValues = new Set(["low", "medium", "high", "xhigh", "max"]);
const executableValues = new Set(["bun", "deno", "node"]);
const sessionStoreFlushValues = new Set(["batched", "eager"]);
const allowedBetas = new Set(["context-1m-2025-08-07"]);
const allowedSettingSources = new Set(["user", "project", "local"]);

// A 组校验（在现有校验逻辑后追加）
if (typeof source.effort === "string" && effortValues.has(source.effort)) {
  options.effort = source.effort as ThinkingEffort;
}
if (typeof source.executable === "string" && executableValues.has(source.executable)) {
  options.executable = source.executable as Executable;
}
if (typeof source.sessionStoreFlush === "string" && sessionStoreFlushValues.has(source.sessionStoreFlush)) {
  options.sessionStoreFlush = source.sessionStoreFlush as SessionStoreFlushValue;
}
if (Array.isArray(source.betas)) {
  options.betas = source.betas.filter((v: unknown) => typeof v === "string" && allowedBetas.has(v));
}
if (Array.isArray(source.settingSources)) {
  options.settingSources = source.settingSources.filter(
    (v: unknown) => typeof v === "string" && allowedSettingSources.has(v)
  ) as SettingSourceValue[];
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 6: 提交**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: sanitizeUserSdkOptions 支持 A 组白名单校验"
```

---

### Task 7: 补全 sanitizeUserSdkOptions（B 组类型守卫 12 个）

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// agentConfig.test.ts 新增
describe("sanitizeUserSdkOptions B 组", () => {
  it("accepts boolean fields", () => {
    const opts = sanitizeUserSdkOptions({
      debug: true,
      strictMcpConfig: false,
      persistSession: true,
      includeHookEvents: false,
      forwardSubagentText: true,
      promptSuggestions: false,
      agentProgressSummaries: true,
      allowDangerouslySkipPermissions: false,
    });
    expect(opts.debug).toBe(true);
    expect(opts.persistSession).toBe(true);
    expect(opts.agentProgressSummaries).toBe(true);
  });

  it("rejects non-boolean values for boolean fields", () => {
    const opts = sanitizeUserSdkOptions({ debug: "yes" });
    expect(opts.debug).toBeUndefined();
  });

  it("accepts string fields", () => {
    const opts = sanitizeUserSdkOptions({
      title: "My Session",
      debugFile: "/tmp/debug.log",
      planModeInstructions: "Custom plan workflow",
      permissionPromptToolName: "mcp__my__tool",
    });
    expect(opts.title).toBe("My Session");
    expect(opts.debugFile).toBe("/tmp/debug.log");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 3: 实现 B 组校验**

```typescript
// agentConfig.ts — sanitizeUserSdkOptions，在 A 组后追加

// B 组：类型守卫
if (typeof source.title === "string") options.title = source.title;
if (typeof source.debug === "boolean") options.debug = source.debug;
if (typeof source.debugFile === "string") options.debugFile = source.debugFile;
if (typeof source.strictMcpConfig === "boolean") options.strictMcpConfig = source.strictMcpConfig;
if (typeof source.persistSession === "boolean") options.persistSession = source.persistSession;
if (typeof source.includeHookEvents === "boolean") options.includeHookEvents = source.includeHookEvents;
if (typeof source.forwardSubagentText === "boolean") options.forwardSubagentText = source.forwardSubagentText;
if (typeof source.promptSuggestions === "boolean") options.promptSuggestions = source.promptSuggestions;
if (typeof source.agentProgressSummaries === "boolean") options.agentProgressSummaries = source.agentProgressSummaries;
if (typeof source.allowDangerouslySkipPermissions === "boolean") options.allowDangerouslySkipPermissions = source.allowDangerouslySkipPermissions;
if (typeof source.planModeInstructions === "string") options.planModeInstructions = source.planModeInstructions;
if (typeof source.permissionPromptToolName === "string") options.permissionPromptToolName = source.permissionPromptToolName;
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: sanitizeUserSdkOptions 支持 B 组类型守卫校验"
```

---

### Task 8: 补全 sanitizeUserSdkOptions（C 组结构校验 10 个）

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// agentConfig.test.ts 新增
describe("sanitizeUserSdkOptions C 组", () => {
  it("accepts valid toolConfig", () => {
    const opts = sanitizeUserSdkOptions({
      toolConfig: { askUserQuestion: { previewFormat: "html" } },
    });
    expect(opts.toolConfig).toEqual({ askUserQuestion: { previewFormat: "html" } });
  });

  it("accepts valid sandbox", () => {
    const opts = sanitizeUserSdkOptions({ sandbox: { enabled: true } });
    expect(opts.sandbox).toEqual({ enabled: true });
  });

  it("accepts valid toolAliases", () => {
    const opts = sanitizeUserSdkOptions({ toolAliases: { Bash: "mcp__workspace__bash" } });
    expect(opts.toolAliases).toEqual({ Bash: "mcp__workspace__bash" });
  });

  it("accepts valid extraArgs", () => {
    const opts = sanitizeUserSdkOptions({ extraArgs: { debug: "true", verbose: null } });
    expect(opts.extraArgs).toEqual({ debug: "true", verbose: null });
  });

  it("accepts agent string", () => {
    const opts = sanitizeUserSdkOptions({ agent: "code-reviewer" });
    expect(opts.agent).toBe("code-reviewer");
  });

  it("accepts settings as string or object", () => {
    expect(sanitizeUserSdkOptions({ settings: "/path/to/settings.json" }).settings).toBe("/path/to/settings.json");
    expect(sanitizeUserSdkOptions({ settings: { model: "test" } }).settings).toEqual({ model: "test" });
  });

  it("accepts resumeSessionAt string", () => {
    const opts = sanitizeUserSdkOptions({ resumeSessionAt: "msg-uuid-123" });
    expect(opts.resumeSessionAt).toBe("msg-uuid-123");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 3: 实现 C 组校验**

```typescript
// agentConfig.ts — sanitizeUserSdkOptions，在 B 组后追加

// C 组：结构校验
if (source.toolConfig && typeof source.toolConfig === "object" && !Array.isArray(source.toolConfig)) {
  options.toolConfig = source.toolConfig as UserSdkOptions["toolConfig"];
}
if (source.sandbox && typeof source.sandbox === "object" && !Array.isArray(source.sandbox)) {
  options.sandbox = source.sandbox as UserSdkOptions["sandbox"];
}
if (Array.isArray(source.plugins)) {
  options.plugins = source.plugins.filter(
    (p: unknown) => p && typeof p === "object" && (p as Record<string, unknown>).type === "local" && typeof (p as Record<string, unknown>).path === "string"
  );
}
if (source.managedSettings && typeof source.managedSettings === "object" && !Array.isArray(source.managedSettings)) {
  options.managedSettings = source.managedSettings as Record<string, unknown>;
}
if (typeof source.settings === "string" || (source.settings && typeof source.settings === "object" && !Array.isArray(source.settings))) {
  options.settings = source.settings as string | Record<string, unknown>;
}
if (source.toolAliases && typeof source.toolAliases === "object" && !Array.isArray(source.toolAliases)) {
  const aliases: Record<string, string> = {};
  for (const [k, v] of Object.entries(source.toolAliases as Record<string, unknown>)) {
    if (typeof v === "string") aliases[k] = v;
  }
  if (Object.keys(aliases).length > 0) options.toolAliases = aliases;
}
if (typeof source.agent === "string") options.agent = source.agent;
if (source.extraArgs && typeof source.extraArgs === "object" && !Array.isArray(source.extraArgs)) {
  const args: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(source.extraArgs as Record<string, unknown>)) {
    if (typeof v === "string" || v === null) args[k] = v;
  }
  if (Object.keys(args).length > 0) options.extraArgs = args;
}
if (Array.isArray(source.executableArgs) && source.executableArgs.every((v: unknown) => typeof v === "string")) {
  options.executableArgs = source.executableArgs as string[];
}
if (typeof source.resumeSessionAt === "string") options.resumeSessionAt = source.resumeSessionAt;
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: sanitizeUserSdkOptions 支持 C 组结构校验"
```

---

### Task 9: 补全权限模式（dontAsk + auto）

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// agentConfig.test.ts 新增
describe("permissionModes", () => {
  it("accepts dontAsk and auto", () => {
    expect(sanitizeUserSdkOptions({ permissionMode: "dontAsk" })).toHaveProperty("permissionMode", "dontAsk");
    expect(sanitizeUserSdkOptions({ permissionMode: "auto" })).toHaveProperty("permissionMode", "auto");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 3: 扩展白名单**

```typescript
// agentConfig.ts
const permissionModes = new Set([
  "default", "acceptEdits", "bypassPermissions", "plan",
  "dontAsk", "auto",
]);
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: 权限模式补全 dontAsk 和 auto"
```

---

### Task 10: loadAgentRuntimeConfig 改用双路径 + codeOptions

**Files:**
- Modify: `electron/agent/agentConfig.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// agentConfig.test.ts 新增
describe("loadAgentRuntimeConfig", () => {
  it("uses resolveSettings path for valid cwd", () => {
    const config = loadAgentRuntimeConfig({ cwd: process.cwd() });
    expect(config.sdkOptions).toHaveProperty("cwd");
    expect(config.sdkOptions).toHaveProperty("includePartialMessages", true);
  });

  it("accepts codeOptions parameter", () => {
    const onElicitation = async () => ({ action: "decline" as const });
    const config = loadAgentRuntimeConfig({
      cwd: process.cwd(),
      codeOptions: { onElicitation },
    });
    expect(config.sdkOptions).toHaveProperty("onElicitation", onElicitation);
  });

  it("merges effort from settings into sdkOptions", () => {
    // 此测试依赖 .claude/settings.local.json 中已设置 effort
    const config = loadAgentRuntimeConfig({ cwd: process.cwd() });
    // sdkOptions 中 effort 来自 resolveSettings 或 loadClaudeCodeSettings
    expect(config.sdkOptions).toHaveProperty("effort");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 3: 修改 loadAgentRuntimeConfig 签名和实现**

```typescript
// agentConfig.ts — 新增 codeOptions 参数
import type { OnElicitation } from "./claudeAgentSdkFacade.js";
import type { SpawnOptions, SpawnedProcess } from "./claudeAgentSdkFacade.js";

export function loadAgentRuntimeConfig(input: {
  cwd: string;
  claudeConfigDir?: string | null;
  userSdkOptions?: unknown;
  codeOptions?: {
    onElicitation?: OnElicitation;
    spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
    stderr?: (data: string) => void;
    abortController?: AbortController;
  };
}): AgentRuntimeConfig {
  const settings = loadClaudeCodeSettings({ cwd: input.cwd });
  const baseUrl = settings.baseUrl.trim();
  const authToken = settings.apiKey.trim();
  const model = settings.model.trim();

  // ... 现有校验逻辑（baseUrl/authToken/model 检查）保持不变 ...
  if (!baseUrl) throw new Error(/* ... */);
  if (!authToken) throw new Error(/* ... */);
  if (!model) throw new Error(/* ... */);
  assertThirdPartyBaseUrl(baseUrl);

  const pathToClaudeCodeExecutable = pathToClaudeCodeExecutableForCwd(input.cwd);
  const userSdkOptions = sanitizeUserSdkOptions(input.userSdkOptions);
  const thinking = {
    display: "summarized" as ThinkingDisplay,
    ...(userSdkOptions.thinking ?? {}),
  };

  // 读取 SettingsFormValues 中的新字段
  const effort = userSdkOptions.effort ?? settings.effort;
  const sandboxEnabled = userSdkOptions.sandbox?.enabled !== undefined
    ? userSdkOptions.sandbox.enabled
    : settings.sandboxEnabled;

  return {
    cwd: input.cwd,
    sdkOptions: {
      ...userSdkOptions,
      cwd: input.cwd,
      ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
      includePartialMessages: true,
      permissionMode: userSdkOptions.permissionMode ?? "default",
      thinking,
      ...(effort ? { effort } : {}),
      ...(sandboxEnabled !== undefined ? {
        sandbox: { ...(userSdkOptions.sandbox ?? {}), enabled: sandboxEnabled },
      } : userSdkOptions.sandbox ? { sandbox: userSdkOptions.sandbox } : {}),
      ...(input.claudeConfigDir ? { env: { CLAUDE_CONFIG_DIR: input.claudeConfigDir } } : {}),
      // 注入 codeOptions
      ...(input.codeOptions?.onElicitation ? { onElicitation: input.codeOptions.onElicitation } : {}),
      ...(input.codeOptions?.spawnClaudeCodeProcess ? { spawnClaudeCodeProcess: input.codeOptions.spawnClaudeCodeProcess } : {}),
      ...(input.codeOptions?.stderr ? { stderr: input.codeOptions.stderr } : {}),
      ...(input.codeOptions?.abortController ? { abortController: input.codeOptions.abortController } : {}),
    },
  };
}
```

- [ ] **Step 4: tsc 检查并运行测试**

```bash
npx tsc -p tsconfig.node.json --noEmit && npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: loadAgentRuntimeConfig 支持 codeOptions 和 settings 新字段合并"
```

---

### Task 11: SettingsPanel 新增推理努力程度和沙箱保护控件

**Files:**
- Modify: `src/app/components/SettingsPanel.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: 写失败组件测试**

```typescript
// SettingsPanel.test.tsx 新增
it("renders effort select with Chinese labels", () => {
  render(<SettingsPanel bridge={mockBridge} onClose={noop} onThemeChange={noop} theme="light" />);
  expect(screen.getByLabelText("推理努力程度")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "低" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "高" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "最大" })).toBeInTheDocument();
});

it("renders sandbox toggle switch", () => {
  render(<SettingsPanel bridge={mockBridge} onClose={noop} onThemeChange={noop} theme="light" />);
  expect(screen.getByText("沙箱保护")).toBeInTheDocument();
  expect(screen.getByText("开")).toBeInTheDocument();
  expect(screen.getByText("关")).toBeInTheDocument();
});

it("saves effort on change", async () => {
  const saveSettings = vi.fn();
  const bridge = { loadSettings: () => Promise.resolve(defaultSettings), saveSettings };
  render(<SettingsPanel bridge={bridge} onClose={noop} onThemeChange={noop} theme="light" />);
  await screen.findByLabelText("推理努力程度");
  fireEvent.change(screen.getByLabelText("推理努力程度"), { target: { value: "max" } });
  expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ effort: "max" }));
});

it("saves sandboxEnabled on toggle", async () => {
  const saveSettings = vi.fn();
  const bridge = { loadSettings: () => Promise.resolve(defaultSettings), saveSettings };
  render(<SettingsPanel bridge={bridge} onClose={noop} onThemeChange={noop} theme="light" />);
  await screen.findByText("沙箱保护");
  fireEvent.click(screen.getByText("开"));
  expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ sandboxEnabled: true }));
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- src/app/components/SettingsPanel.test.tsx
```

- [ ] **Step 3: 实现 UI 控件**

在 `SettingsPanel.tsx` 中添加：

```tsx
// 状态声明
const [effort, setEffort] = useState("high");
const [sandboxEnabled, setSandboxEnabled] = useState(false);

// useEffect 中读取初始值
useEffect(() => {
  bridge.loadSettings().then((s) => {
    // ... 现有逻辑 ...
    setEffort(s.effort || "high");
    setSandboxEnabled(s.sandboxEnabled ?? false);
  });
}, [bridge]);

// handleSave 中传入新字段
function handleSave() {
  bridge.saveSettings({ baseUrl, apiKey, model, effort, sandboxEnabled });
}

// JSX — 在"思考强度"select 之后追加：
<div className="setting-row">
  <label className="setting-label" htmlFor="sdk-effort">推理努力程度</label>
  <select id="sdk-effort" aria-label="推理努力程度"
    value={effort} onChange={(e) => { setEffort(e.target.value); handleSave(); }}>
    <option value="low">低</option>
    <option value="medium">中</option>
    <option value="high">高</option>
    <option value="xhigh">极高</option>
    <option value="max">最大</option>
  </select>
</div>

// JSX — 在"主题"之后追加：
<div className="setting-row-inline">
  <span className="setting-label">沙箱保护</span>
  <div className="sandbox-switch">
    <button
      className={sandboxEnabled ? "active" : ""}
      onClick={() => { setSandboxEnabled(true); handleSave(); }}>
      开
    </button>
    <button
      className={!sandboxEnabled ? "active" : ""}
      onClick={() => { setSandboxEnabled(false); handleSave(); }}>
      关
    </button>
  </div>
</div>
```

同时扩展本地 `SettingsFormValues` 类型：

```typescript
type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
  effort?: string;
  sandboxEnabled?: boolean;
};
```

- [ ] **Step 4: 添加 CSS**

```css
/* src/ui/styles.css — 在 .theme-switch 附近追加 */

/* ============================================================
   SANDBOX SWITCH — 沙箱保护开关（复用 theme-switch 模式）
   ============================================================ */
.sandbox-switch {
  display: flex;
  gap: 1px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.sandbox-switch button {
  padding: 4px 10px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  cursor: pointer;
}

.sandbox-switch button.active {
  background: var(--bg-sidebar-active);
  color: var(--text-primary);
  font-weight: 600;
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test -- src/app/components/SettingsPanel.test.tsx
```

- [ ] **Step 6: tsc 检查渲染进程类型**

```bash
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 7: 提交**

```bash
git add src/app/components/SettingsPanel.tsx src/ui/styles.css src/app/components/SettingsPanel.test.tsx
git commit -m "feat: SettingsPanel 新增推理努力程度和沙箱保护控件"
```

---

### Task 12: backendBridge 和 App.tsx 类型同步

**Files:**
- Modify: `src/app/backendBridge.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: 更新 backendBridge 类型**

```typescript
// backendBridge.ts — loadSettings 返回值类型
loadSettings() {
  return api.invoke("settings:get", undefined) as Promise<{
    baseUrl: string;
    apiKey: string;
    model: string;
    effort?: string;
    sandboxEnabled?: boolean;
  }>;
},
```

`saveSettings` 签名同步更新：

```typescript
saveSettings(settings: {
  baseUrl: string;
  apiKey: string;
  model: string;
  effort?: string;
  sandboxEnabled?: boolean;
}) {
  return api.invoke("settings:save", settings);
},
```

- [ ] **Step 2: 运行 tsc 检查**

```bash
npx tsc -p tsconfig.json --noEmit
```

确认 `App.tsx` 和 `SettingsPanel.tsx` 没有类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/app/backendBridge.ts
git commit -m "fix: backendBridge SettingsFormValues 同步 effort/sandboxEnabled"
```

---

### Task 13: 最终构建验证

- [ ] **Step 1: 运行全部后端测试**

```bash
npm test -- electron/agent/agentConfig.test.ts electron/agent/sdkSettings.test.ts electron/agent/claudeAgentSdkFacade.test.ts
```

- [ ] **Step 2: 运行组件测试**

```bash
npm test -- src/app/components/SettingsPanel.test.tsx
```

- [ ] **Step 3: 完整构建**

```bash
npm run build
```

预期：三遍 tsc 全部通过，无类型错误。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: Plan 1 最终验证通过"
```

---

## 验证 Checklist

- [ ] `npm run build` 通过（三遍 tsc）
- [ ] 所有新增测试通过
- [ ] SettingsPanel 中两个新控件渲染正常
- [ ] `effort` 下拉选择后立即保存
- [ ] `sandboxEnabled` 开关切换后立即保存
- [ ] `dontAsk` 和 `auto` 权限模式通过校验
- [ ] `foldSessionSummary` 可从 facade 正确导入
- [ ] `loadResolvedSettings` 在异常时回退到手动路径
