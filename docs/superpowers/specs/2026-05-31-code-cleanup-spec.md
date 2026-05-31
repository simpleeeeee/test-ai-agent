# Spec 4: 代码清理

> **状态**: 设计已确认，待实现
> **日期**: 2026-05-31
> **前提**: 本项目仅使用中国大陆第三方 LLM API，不使用 Anthropic 官方 API
> **依赖**: Spec 2（`getContextUsage` 暴露后 `countPromptTokens` 不再需要）

## 一、概述

清理 2 处代码问题：删除 `countPromptTokens()` 占位函数、修正 Base URL 校验的错误消息为中文。

## 二、改动清单

### 2.1 删除 `countPromptTokens()` 占位函数

**文件**: `electron/agent/claudeAgentSdkFacade.ts`

**删除内容**:
```typescript
export async function countPromptTokens(): Promise<{ inputTokens: number }> {
  throw new Error("countTokens is not available in the installed Claude Agent SDK version");
}
```

**理由**: 该函数只有一个 `throw` 语句，无实际功能。Spec 2 已暴露 `getContextUsage()` 方法提供完整的上下文窗口 token 使用详情，可完全替代此占位函数。

### 2.2 修正 Base URL 错误消息

**文件**: `electron/agent/agentConfig.ts`，`assertThirdPartyBaseUrl()` 函数

**修改**:
```typescript
// 之前
throw new Error("Official Anthropic endpoints are not allowed");

// 之后
throw new Error("请使用第三方 API 网关地址，不支持 Anthropic 官方端点");
```

**理由**:
- 中文消息，与项目 CLAUDE.md 的语言要求一致
- 明确告知用户正确的操作方式（使用第三方网关），而非仅仅拒绝
- 不再暗示 Anthropic 官方端点是可用选项

## 三、影响文件

| 文件 | 改动 | 行数 |
|------|------|:--:|
| `electron/agent/claudeAgentSdkFacade.ts` | 删除 `countPromptTokens` 函数 | -3 |
| `electron/agent/agentConfig.ts` | 修改 `assertThirdPartyBaseUrl` 错误消息 | 1 |
| `electron/agent/claudeAgentSdkFacade.test.ts` | 确认函数不再导出（如需） | - |

## 四、测试

```bash
# 类型检查——确认删除后无引用报错
npm run build
```

`countPromptTokens` 被删除后，如果有任何文件仍引用它，`tsc` 会报错。如果无引用报错则验证通过。

## 五、不在范围内

- 不做其他代码重构
- 不修改其他错误消息
