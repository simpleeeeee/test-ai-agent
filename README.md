# AI 测试助手

面向中文测试人员的桌面端 Electron 应用。用自然语言描述测试场景，AI 自动生成测试计划、执行 MCP 工具调用、收集证据并生成缺陷草稿。

## ⚠️ 重要声明

此仓库代码仅供 **个人学习、面试评估、技术交流** 使用。  
严禁任何个人或组织在 **生产环境、商业产品或内部工具中** 直接运行或集成。
如需商用授权，请邮件联系：zuhang.meng@gmail.com

> 本项目的具体许可条款，请以仓库根目录下的 [LICENSE](./LICENSE) 文件为准。

## 技术栈

Electron · Vite · React 19 · TypeScript · Vitest · React Testing Library · Playwright · lucide-react · zod · Claude Agent SDK

## 快速开始

```bash
npm install
npm run dev          # 启动 Vite 开发服务器 → http://127.0.0.1:5173
npm run electron     # 启动 Electron 窗口
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | Vite 开发服务器（渲染进程热更新） |
| `npm run electron` | 启动 Electron 应用 |
| `npm run build` | 类型检查 + Vite 生产构建 |
| `npm run build:electron` | 仅编译 Electron 主进程 |
| `npm test` | 运行全部单元/组件测试 |
| `npm test -- <path>` | 运行指定测试文件 |
| `npm run test:watch` | 测试监听模式 |
| `npm run e2e` | Playwright 端到端测试 |
| `npm run pack` | 打包为免安装目录 |
| `npm run dist` | 打包为平台安装器 |
| `npm run pack:cn` | 打包（使用中国镜像加速） |
| `npm run dist:cn` | 打包为安装器（使用中国镜像加速） |

## 打包发布

```bash
npm run dist:cn     # 生成 Windows 安装器 → release/
npm run pack:cn     # 生成免安装目录 → release/win-unpacked/
```

macOS 和 Linux 构建需在对应平台执行。

## 项目架构

### 事件溯源领域模型（`src/domain/testRun.ts`）

整个测试运行的状态由单一 `TestRun` 实体承载。所有状态变更通过纯函数 `applyRunEvent(run, event) → TestRun` 完成，不存在分散的 setState 派发逻辑。

### 后端运行时（`electron/agent/`）

```
electron/agent/
├── claudeAgentSdkFacade.ts    # SDK 导入边界（唯一允许导入 @anthropic-ai/claude-agent-sdk 的文件）
├── agentConfig.ts             # 第三方 LLM 网关配置加载、环境变量清理
├── asyncMessageQueue.ts       # AsyncIterable 流式输入队列
├── runEventMapper.ts          # SDK 消息 → RunEvent 映射
├── approvalBridge.ts          # canUseTool / AskUserQuestion 审批桥接
├── claudeAgentRuntimeAdapter.ts  # SDK query() 包装和 Query 控制透传
├── agentSessionManager.ts     # 运行/会话/审批/流式输入的集中管理
└── backendRuntime.ts          # 后端运行时组合入口
```

### IPC 协议（`src/ipc/`）

29 个渲染进程→主进程通道和 23 个主进程→渲染进程事件通道，全部通过类型化和 zod schema 校验。preload 暴露 `send`/`invoke`/`on` 三种安全 API。

### UI 结构（`src/app/`）

单页对话工作台（无路由），Claude Desktop 风格布局。组件通过 `useReducer` + SDK Event Store 驱动，所有通信通过 `backendBridge` 走 IPC。

```
src/app/
├── App.tsx                    # 主应用（左侧会话栏、中央消息流、底部输入区）
├── backendBridge.ts           # 渲染进程侧 IPC 封装
├── sdkEventStore.ts           # SDK UI 事件折叠 reducer
├── sdkUiTypes.ts              # UI 状态类型定义
└── components/
    ├── MessageStream.tsx       # 消息流（文本、工具调用、审批、问题、证据）
    ├── ToolApprovalCard.tsx    # 工具授权审批卡片
    ├── AskUserQuestionCard.tsx # Agent 澄清问题表单
    ├── SdkControlDrawer.tsx    # SDK 控制抽屉（模型/权限/Flag）
    ├── SessionPanel.tsx        # 会话管理面板
    └── McpStatusPanel.tsx      # MCP 服务状态面板
```

### 测试分层

| 层级 | 工具 | 位置 |
|------|------|------|
| 领域逻辑 | Vitest | `src/domain/*.test.ts` |
| Agent 运行时 | Vitest | `src/agent/*.test.ts` |
| 后端单元 | Vitest | `electron/agent/*.test.ts` |
| IPC 协议 | Vitest | `src/ipc/*.test.ts`、`electron/preload.test.ts`、`electron/main.test.ts` |
| 组件行为 | Vitest + RTL | `src/app/*.test.tsx`、`src/app/components/*.test.tsx` |
| E2E 用户流程 | Playwright | `tests/e2e/*.spec.ts` |

## 第三方 LLM 网关配置

本应用不直接调用 Anthropic API，需要配置第三方兼容网关。设置以下环境变量：

| 变量 | 说明 | 必填 |
|------|------|------|
| `AI_TEST_LLM_BASE_URL` | 第三方网关地址（**禁止** `api.anthropic.com`） | 是 |
| `AI_TEST_LLM_AUTH_TOKEN` | 网关认证令牌 | 是 |
| `AI_TEST_LLM_MODEL` | 模型名称（可选） | 否 |
| `AI_TEST_LLM_CUSTOM_HEADERS_JSON` | 自定义 HTTP 头（JSON 格式） | 否 |
| `AI_TEST_LLM_ENABLE_MODEL_DISCOVERY` | 启用模型发现（`1`=启用） | 否 |

示例（PowerShell）：

```powershell
$env:AI_TEST_LLM_BASE_URL="https://your-gateway.example.com/anthropic"
$env:AI_TEST_LLM_AUTH_TOKEN="your-token"
$env:AI_TEST_LLM_MODEL="claude-sonnet-4-6"
npm run electron
```

## Git 提交规范

提交信息使用中文，格式：`<类型>: <简要描述>`，例如 `feat: 添加测试运行领域模型`、`fix: 修复事件排序问题`。
