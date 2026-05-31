# Claude Agent SDK 原生配置读取适配 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 settings 读写和 SDK 启动配置改为 Claude Code 原生方式：去掉 `$schema`、支持 `.claude/settings.local.json` 覆盖、SDK options 不再强制指定 `settings` 路径。

**Architecture:** 核心改动集中在 `electron/agent/sdkSettings.ts`（settings 读写逻辑）和 `electron/agent/agentConfig.ts`（SDK 启动配置）。`main.ts` 中已有的 `appBaseDirectory()` 保持不变。所有配置路径由 `cwd` 参数派生，local 文件覆盖 shared 文件的合并逻辑在读取时完成。

**Tech Stack:** TypeScript、Vitest、Node.js fs/path

---

### Task 1: 更新 `ensureClaudeCodeSettings` — 去掉 `$schema`，检查两个文件

**Files:**
- Modify: `electron/agent/sdkSettings.ts`
- Modify: `electron/agent/sdkSettings.test.ts`

- [ ] **Step 1: 更新测试，断言自动创建的文件不包含 `$schema`，且两个文件都不存在时才创建**

```typescript
// electron/agent/sdkSettings.test.ts — 替换 "creates an empty native settings template when packaging needs a visible file" 测试
it("creates a minimal native settings file without $schema when packaging needs a visible file", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));

  const settingsPath = ensureClaudeCodeSettings({ cwd });

  expect(settingsPath).toBe(settingsPathForCwd(cwd));
  const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  expect(parsed).toEqual({
    env: {
      ANTHROPIC_BASE_URL: "",
      ANTHROPIC_AUTH_TOKEN: "",
      ANTHROPIC_MODEL: "",
    },
  });
  expect(parsed).not.toHaveProperty("$schema");
});
```

```typescript
// electron/agent/sdkSettings.test.ts — 新增测试：local 文件存在时不创建 shared
it("does not create settings.json when settings.local.json already exists", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
  fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
  fs.writeFileSync(settingsLocalPathForCwd(cwd), JSON.stringify({
    env: { ANTHROPIC_MODEL: "local-model" },
  }, null, 2));

  ensureClaudeCodeSettings({ cwd });

  expect(fs.existsSync(settingsPathForCwd(cwd))).toBe(false);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run electron/agent/sdkSettings.test.ts
```
Expected: 2 tests FAIL — 一个因为 `$schema` 仍存在，另一个因为 `settingsLocalPathForCwd` 未定义

- [ ] **Step 3: 实现 `settingsLocalPathForCwd` 并更新 `ensureClaudeCodeSettings`**

```typescript
// electron/agent/sdkSettings.ts

// 在 settingsPathForCwd 下方新增
export function settingsLocalPathForCwd(cwd: string) {
  return path.join(cwd, ".claude", "settings.local.json");
}

// 修改 emptyNativeSettings — 去掉 $schema
function emptyNativeSettings(): NativeClaudeCodeSettings {
  return {
    env: {
      ANTHROPIC_BASE_URL: "",
      ANTHROPIC_AUTH_TOKEN: "",
      ANTHROPIC_MODEL: "",
    },
  };
}

// 修改 ensureClaudeCodeSettings — 两个文件都不存在时才创建
export function ensureClaudeCodeSettings({ cwd }: { cwd: string }) {
  const settingsPath = settingsPathForCwd(cwd);
  const localPath = settingsLocalPathForCwd(cwd);
  if (!fs.existsSync(settingsPath) && !fs.existsSync(localPath)) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, `${JSON.stringify(emptyNativeSettings(), null, 2)}\n`, "utf8");
  }
  return settingsPath;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run electron/agent/sdkSettings.test.ts
```
Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add electron/agent/sdkSettings.ts electron/agent/sdkSettings.test.ts
git commit -m "feat: ensureClaudeCodeSettings 去掉 \$schema，local 文件存在时跳过创建"
```

---

### Task 2: 更新 `loadClaudeCodeSettings` — 合并 local 覆盖 shared

**Files:**
- Modify: `electron/agent/sdkSettings.ts`
- Modify: `electron/agent/sdkSettings.test.ts`

- [ ] **Step 1: 添加合并读取测试**

```typescript
// electron/agent/sdkSettings.test.ts — 新增测试
it("merges settings.local.json over settings.json for UI fields", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
  fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
  fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
    env: {
      ANTHROPIC_BASE_URL: "https://shared.example.com",
      ANTHROPIC_AUTH_TOKEN: "shared-token",
      ANTHROPIC_MODEL: "shared-model",
    },
  }, null, 2));
  fs.writeFileSync(settingsLocalPathForCwd(cwd), JSON.stringify({
    env: {
      ANTHROPIC_MODEL: "local-model",
    },
  }, null, 2));

  expect(loadClaudeCodeSettings({ cwd })).toEqual({
    baseUrl: "https://shared.example.com",
    apiKey: "shared-token",
    model: "local-model",
  });
});

it("returns empty UI values when neither settings file exists", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));

  expect(loadClaudeCodeSettings({ cwd })).toEqual({
    baseUrl: "",
    apiKey: "",
    model: "",
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run electron/agent/sdkSettings.test.ts
```
Expected: 合并测试 FAIL — 当前只读 shared 文件

- [ ] **Step 3: 更新 `loadClaudeCodeSettings` 实现合并逻辑**

```typescript
// electron/agent/sdkSettings.ts — 替换 loadClaudeCodeSettings
export function loadClaudeCodeSettings({ cwd }: { cwd: string }): SettingsFormValues {
  const shared = readNativeSettings(settingsPathForCwd(cwd));
  const local = readNativeSettings(settingsLocalPathForCwd(cwd));
  return {
    baseUrl: stringValue(local.env?.ANTHROPIC_BASE_URL ?? shared.env?.ANTHROPIC_BASE_URL),
    apiKey: stringValue(local.env?.ANTHROPIC_AUTH_TOKEN ?? shared.env?.ANTHROPIC_AUTH_TOKEN),
    model: stringValue(local.env?.ANTHROPIC_MODEL ?? shared.env?.ANTHROPIC_MODEL),
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run electron/agent/sdkSettings.test.ts
```
Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add electron/agent/sdkSettings.ts electron/agent/sdkSettings.test.ts
git commit -m "feat: loadClaudeCodeSettings 合并 settings.local.json 覆盖 settings.json"
```

---

### Task 3: 更新 `saveClaudeCodeSettings` — local 优先保存，保留原生字段，不写 `$schema`

**Files:**
- Modify: `electron/agent/sdkSettings.ts`
- Modify: `electron/agent/sdkSettings.test.ts`

- [ ] **Step 1: 更新现有保存测试，去掉 `$schema` 断言**

```typescript
// electron/agent/sdkSettings.test.ts — 替换 "writes the native Claude Code project settings shape" 测试
it("writes the native Claude Code project settings shape without $schema", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));

  const saved = saveClaudeCodeSettings({
    cwd,
    baseUrl: "https://gateway.example.com/anthropic",
    apiKey: "plain-text-key",
    model: "claude-compatible-model",
  });

  expect(saved).toEqual({
    env: {
      ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
      ANTHROPIC_AUTH_TOKEN: "plain-text-key",
      ANTHROPIC_MODEL: "claude-compatible-model",
    },
  });
  expect(saved).not.toHaveProperty("$schema");
  expect(JSON.parse(fs.readFileSync(settingsPathForCwd(cwd), "utf8"))).toEqual(saved);
});
```

- [ ] **Step 2: 添加 local 优先保存和原生字段保留测试**

```typescript
// electron/agent/sdkSettings.test.ts — 新增测试
it("saves to settings.local.json when it already exists", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
  fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
  fs.writeFileSync(settingsLocalPathForCwd(cwd), JSON.stringify({
    env: { ANTHROPIC_MODEL: "old-local-model" },
  }, null, 2));

  saveClaudeCodeSettings({
    cwd,
    baseUrl: "https://gateway.example.com/anthropic",
    apiKey: "new-key",
    model: "new-model",
  });

  const local = JSON.parse(fs.readFileSync(settingsLocalPathForCwd(cwd), "utf8"));
  expect(local.env.ANTHROPIC_BASE_URL).toBe("https://gateway.example.com/anthropic");
  expect(local.env.ANTHROPIC_AUTH_TOKEN).toBe("new-key");
  expect(local.env.ANTHROPIC_MODEL).toBe("new-model");
  // shared 文件不应该被创建
  expect(fs.existsSync(settingsPathForCwd(cwd))).toBe(false);
});

it("preserves existing native fields when saving", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
  fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
  fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
    env: { ANTHROPIC_MODEL: "old-model", OTHER_VAR: "kept" },
    permissions: { allow: ["Bash(npm test *)"] },
    hooks: { PostToolUse: [{ matcher: "", hooks: [] }] },
    enabledPlugins: ["plugin-a"],
    extraKnownMarketplaces: [{ source: "github" }],
    apiKeyHelper: "/bin/helper.sh",
  }, null, 2));

  saveClaudeCodeSettings({
    cwd,
    baseUrl: "https://gateway.example.com/anthropic",
    apiKey: "new-key",
    model: "new-model",
  });

  const saved = JSON.parse(fs.readFileSync(settingsPathForCwd(cwd), "utf8"));
  expect(saved.env.ANTHROPIC_BASE_URL).toBe("https://gateway.example.com/anthropic");
  expect(saved.env.ANTHROPIC_AUTH_TOKEN).toBe("new-key");
  expect(saved.env.ANTHROPIC_MODEL).toBe("new-model");
  expect(saved.env.OTHER_VAR).toBe("kept");
  expect(saved.permissions).toEqual({ allow: ["Bash(npm test *)"] });
  expect(saved.hooks).toEqual({ PostToolUse: [{ matcher: "", hooks: [] }] });
  expect(saved.enabledPlugins).toEqual(["plugin-a"]);
  expect(saved.extraKnownMarketplaces).toEqual([{ source: "github" }]);
  expect(saved.apiKeyHelper).toBe("/bin/helper.sh");
});

it("preserves $schema when user already has it in their file", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-settings-"));
  fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
  fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
    $schema: "https://json.schemastore.org/claude-code-settings.json",
    env: { ANTHROPIC_MODEL: "old-model" },
  }, null, 2));

  saveClaudeCodeSettings({
    cwd,
    baseUrl: "",
    apiKey: "",
    model: "new-model",
  });

  const saved = JSON.parse(fs.readFileSync(settingsPathForCwd(cwd), "utf8"));
  expect(saved.$schema).toBe("https://json.schemastore.org/claude-code-settings.json");
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npx vitest run electron/agent/sdkSettings.test.ts
```
Expected: 多个测试 FAIL — 旧代码仍写入 `$schema`，且无 local 优先保存逻辑

- [ ] **Step 4: 更新 `saveClaudeCodeSettings` 实现**

```typescript
// electron/agent/sdkSettings.ts — 替换 saveClaudeCodeSettings
export function saveClaudeCodeSettings(input: SettingsFormValues & { cwd: string }): NativeClaudeCodeSettings {
  const localPath = settingsLocalPathForCwd(input.cwd);
  const sharedPath = settingsPathForCwd(input.cwd);

  let targetPath: string;
  if (fs.existsSync(localPath)) {
    targetPath = localPath;
  } else {
    targetPath = sharedPath;
  }

  const existing = readNativeSettings(targetPath);
  const settings: NativeClaudeCodeSettings = {
    ...existing,
    env: {
      ...(existing.env ?? {}),
      ANTHROPIC_BASE_URL: input.baseUrl.trim(),
      ANTHROPIC_AUTH_TOKEN: input.apiKey.trim(),
      ANTHROPIC_MODEL: input.model.trim(),
    },
  };

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}
```

同时删除不再使用的 `CLAUDE_SETTINGS_SCHEMA` 常量。

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run electron/agent/sdkSettings.test.ts
```
Expected: 所有测试 PASS

- [ ] **Step 6: 提交**

```bash
git add electron/agent/sdkSettings.ts electron/agent/sdkSettings.test.ts
git commit -m "feat: saveClaudeCodeSettings local 优先保存，保留原生字段，不写 \$schema"
```

---

### Task 4: 更新 `loadAgentRuntimeConfig` — SDK options 去掉 `settings`，错误信息指向两个文件

**Files:**
- Modify: `electron/agent/agentConfig.ts`
- Modify: `electron/agent/agentConfig.test.ts`

- [ ] **Step 1: 更新测试，断言 sdkOptions 不含 `settings`，且错误信息指向两个文件**

```typescript
// electron/agent/agentConfig.test.ts — 替换 "uses the native project settings file as the SDK settings source" 测试
it("uses app base directory as cwd and does not force settings path", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));
  fs.mkdirSync(path.join(cwd, ".claude"), { recursive: true });
  const unpackedClaudeExe = path.join(
    cwd, "resources", "app.asar.unpacked", "node_modules",
    "@anthropic-ai", "claude-agent-sdk-win32-x64", "claude.exe",
  );
  fs.mkdirSync(path.dirname(unpackedClaudeExe), { recursive: true });
  fs.writeFileSync(unpackedClaudeExe, "");
  fs.writeFileSync(settingsPathForCwd(cwd), JSON.stringify({
    env: {
      ANTHROPIC_BASE_URL: "https://gateway.example.com/anthropic",
      ANTHROPIC_AUTH_TOKEN: "third-party-token",
      ANTHROPIC_MODEL: "claude-compatible-test-model",
    },
  }, null, 2));

  const config = loadAgentRuntimeConfig({ cwd, env: { PATH: "C:/bin" } });

  expect(config.sdkOptions).toEqual(expect.objectContaining({
    cwd,
    includePartialMessages: true,
    permissionMode: "default",
  }));
  expect(config.sdkOptions).not.toHaveProperty("settings");
  expect(config.sdkOptions).not.toHaveProperty("model");
});

// 替换 "fails fast when the native settings file is missing required fields" 测试
it("fails fast when required env fields are missing from both settings files", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ai-test-agent-config-"));

  expect(() => loadAgentRuntimeConfig({ cwd, env: {} }))
    .toThrow(/\.claude\/settings\.json.*\.claude\/settings\.local\.json/);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run electron/agent/agentConfig.test.ts
```
Expected: FAIL — sdkOptions 仍含 `settings`，错误信息不含 local 文件

- [ ] **Step 3: 更新 `loadAgentRuntimeConfig` 实现**

```typescript
// electron/agent/agentConfig.ts — 修改 loadAgentRuntimeConfig

// 删除不再需要的 settingsPath 导入
import { loadClaudeCodeSettings } from "./sdkSettings.js";

// 在 AgentRuntimeConfig 类型中移除 settingsPath
export type AgentRuntimeConfig = {
  cwd: string;
  sdkOptions: Record<string, unknown>;
  sanitizedEnv: Record<string, string>;
};

// 更新错误信息
export function loadAgentRuntimeConfig(input: {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): AgentRuntimeConfig {
  const env = input.env ?? process.env;
  const settings = loadClaudeCodeSettings({ cwd: input.cwd });
  const baseUrl = settings.baseUrl.trim();
  const authToken = settings.apiKey.trim();
  const model = settings.model.trim();

  if (!baseUrl) {
    throw new Error(
      ".claude/settings.json or .claude/settings.local.json is required: env.ANTHROPIC_BASE_URL is missing",
    );
  }
  if (!authToken) {
    throw new Error(
      ".claude/settings.json or .claude/settings.local.json is required: env.ANTHROPIC_AUTH_TOKEN is missing",
    );
  }
  if (!model) {
    throw new Error(
      ".claude/settings.json or .claude/settings.local.json is required: env.ANTHROPIC_MODEL is missing",
    );
  }
  assertThirdPartyBaseUrl(baseUrl);

  const sanitizedEnv = sanitizeProcessEnv(env);
  const pathToClaudeCodeExecutable = pathToClaudeCodeExecutableForCwd(input.cwd);

  return {
    cwd: input.cwd,
    sanitizedEnv,
    sdkOptions: {
      cwd: input.cwd,
      ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
      includePartialMessages: true,
      permissionMode: "default",
    },
  };
}
```

同时删除 `settingsPathForCwd` 的导入（如果不再需要）。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run electron/agent/agentConfig.test.ts
```
Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "feat: SDK options 去掉 settings 路径，错误信息指向两个 settings 文件"
```

---

### Task 5: 更新 `electron/main.test.ts` — 适配新行为

**Files:**
- Modify: `electron/main.test.ts`

- [ ] **Step 1: 更新测试中引用的 `$schema` 相关断言**

`electron/main.test.ts` 中的测试 mock 了 `sdkSettings` 模块，不直接测试 settings 内容。检查是否有测试依赖旧的 `AgentRuntimeConfig` 类型（含 `settingsPath`）。当前测试中 `createBackendRuntime` 被整体 mock，`sessionManager` 也被 mock，不直接引用 settings 结构。

检查 `main.test.ts` 第 106 行的断言：

```typescript
expect(ensureClaudeCodeSettings).toHaveBeenCalledWith({ cwd: appDir });
```

这个断言不需要改动，因为 `ensureClaudeCodeSettings` 的签名没变。

需要确认 `agentSessionManager.test.ts` 是否引用了 `AgentRuntimeConfig` 类型中的 `settingsPath`：

查看 `agentSessionManager.test.ts`，测试中 `loadConfig` 返回 `{ sdkOptions: { cwd: "D:/repo" } }` 和 `{ sdkOptions: { settings: "D:/app/.claude/settings.json" } }`。第二个测试中用了 `settings` 字段。需要更新。

```typescript
// electron/agent/agentSessionManager.test.ts — 替换 "loads SDK settings from the configured app directory instead of process cwd" 测试
it("loads SDK settings from the configured app directory instead of process cwd", async () => {
  async function* messages() {
    yield { type: "result", subtype: "success", session_id: "session-1" };
  }
  const loadConfig = vi.fn(() => ({ sdkOptions: { cwd: "D:/app" } }));
  const manager = new AgentSessionManager({
    adapter: { start: vi.fn(() => ({ messages: messages(), close: vi.fn() })) } as any,
    loadConfig,
    emit: vi.fn(),
    cwd: "D:/app",
  });

  await manager.startRun("run-1", "测试订单模块功能");

  expect(loadConfig).toHaveBeenCalledWith({ cwd: "D:/app" });
});
```

- [ ] **Step 2: 运行测试确认通过**

```bash
npx vitest run electron/main.test.ts electron/agent/agentSessionManager.test.ts
```
Expected: 所有测试 PASS

- [ ] **Step 3: 提交**

```bash
git add electron/main.test.ts electron/agent/agentSessionManager.test.ts
git commit -m "test: 更新测试以适配去掉 settings 路径和 settingsPath 字段"
```

---

### Task 6: 运行全量测试和类型检查

**Files:** 无新建或修改

- [ ] **Step 1: 运行全部单元测试**

```bash
npm test
```
Expected: 所有测试 PASS

- [ ] **Step 2: 运行类型检查**

```bash
npm run build
```
Expected: 类型检查和构建均通过

- [ ] **Step 3: 提交（如有修复）**

```bash
git add -A
git commit -m "chore: 修复类型检查和测试问题"
```
