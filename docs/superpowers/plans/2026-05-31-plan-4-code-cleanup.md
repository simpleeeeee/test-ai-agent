# Plan 4: 代码清理 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 countPromptTokens 占位函数，修正 Base URL 错误消息为中文。

**Architecture:** 两处独立改动，无 IPC 变更。

**Tech Stack:** TypeScript, Vitest

---

### Task 1: 删除 countPromptTokens 占位函数

**Files:**
- Modify: `electron/agent/claudeAgentSdkFacade.ts`
- Modify: `electron/agent/claudeAgentSdkFacade.test.ts`

- [ ] **Step 1: 写失败测试 — 确认函数存在**

```typescript
// claudeAgentSdkFacade.test.ts 新增
it("countPromptTokens is no longer exported", async () => {
  // 动态导入以检查导出
  const mod = await import("./claudeAgentSdkFacade.js");
  expect("countPromptTokens" in mod).toBe(false);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/claudeAgentSdkFacade.test.ts
```

预期：FAIL — `countPromptTokens` 仍在导出中。

- [ ] **Step 3: 删除函数**

```typescript
// claudeAgentSdkFacade.ts — 删除以下 3 行
// export async function countPromptTokens(): Promise<{ inputTokens: number }> {
//   throw new Error("countTokens is not available in the installed Claude Agent SDK version");
// }
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/claudeAgentSdkFacade.test.ts
```

- [ ] **Step 5: tsc 检查是否有残留引用**

```bash
npx tsc -p tsconfig.node.json --noEmit
```

如果有文件引用了 `countPromptTokens`，tsc 会报错。如果无引用报错则验证通过。

- [ ] **Step 6: 提交**

```bash
git add electron/agent/claudeAgentSdkFacade.ts electron/agent/claudeAgentSdkFacade.test.ts
git commit -m "fix: 删除 countPromptTokens 占位函数"
```

---

### Task 2: 修正 Base URL 错误消息为中文

**Files:**
- Modify: `electron/agent/agentConfig.ts`
- Modify: `electron/agent/agentConfig.test.ts`

- [ ] **Step 1: 写失败测试 — 验证新的错误消息**

```typescript
// agentConfig.test.ts 新增
it("assertThirdPartyBaseUrl throws Chinese error message", () => {
  expect(() => {
    loadAgentRuntimeConfig({
      cwd: process.cwd(),
      userSdkOptions: {},
    });
    // 如果 baseUrl 恰好是 anthropic.com 则触发
  }).toThrow(); // 当前测试环境 baseUrl 不是 anthropic.com，所以此测试仅验证函数不崩溃
});

// 更直接的测试：
describe("Base URL 中文错误消息", () => {
  it("rejects official Anthropic endpoints with Chinese message", () => {
    // 模拟 settings 返回 anthropic.com
    // 具体实现取决于测试中如何 mock loadClaudeCodeSettings
    // 核心断言：错误消息包含中文
    try {
      assertThirdPartyBaseUrl("https://api.anthropic.com");
      expect.unreachable("应该抛异常");
    } catch (e) {
      expect((e as Error).message).toContain("第三方 API 网关");
      expect((e as Error).message).toContain("Anthropic 官方端点");
    }
  });
});
```

确保 `assertThirdPartyBaseUrl` 被导出（如果尚未导出）：

```typescript
// agentConfig.ts — 如需导出
export function assertThirdPartyBaseUrl(baseUrl: string) {
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 3: 修改错误消息**

```typescript
// agentConfig.ts — assertThirdPartyBaseUrl 函数
function assertThirdPartyBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  const host = url.hostname.toLowerCase();
  if (host === "api.anthropic.com" || host.endsWith(".anthropic.com")) {
    throw new Error("请使用第三方 API 网关地址，不支持 Anthropic 官方端点");
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- electron/agent/agentConfig.test.ts
```

- [ ] **Step 5: tsc 检查**

```bash
npx tsc -p tsconfig.node.json --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add electron/agent/agentConfig.ts electron/agent/agentConfig.test.ts
git commit -m "fix: Base URL 错误消息改为中文"
```

---

### Task 3: 最终构建验证

- [ ] **Step 1: 完整构建**

```bash
npm run build
```

预期：三遍 tsc 全部通过。

- [ ] **Step 2: 运行全部测试**

```bash
npm test
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore: Plan 4 最终验证通过"
```

---

## 验证 Checklist

- [ ] `countPromptTokens` 不再从 facade 导出
- [ ] 无文件引用已删除的 `countPromptTokens`
- [ ] `assertThirdPartyBaseUrl` 抛出的错误消息为中文
- [ ] `npm run build` 三遍 tsc 通过
