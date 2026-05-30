# AI 测试助手

面向中文测试人员的桌面端 Electron 应用。通过自然语言创建测试运行、审批工具调用、回答澄清问题、查看证据和缺陷草稿，并管理 Claude Agent SDK 会话与配置。

## ⚠️ 重要声明

此仓库代码仅供 **个人学习、面试评估、技术交流** 使用。  
严禁任何个人或组织在 **生产环境、商业产品或内部工具中** 直接运行或集成。  
如需商用授权，请邮件联系：zuhang.meng@gmail.com

> 本项目的具体许可条款，请以仓库根目录下的 [LICENSE](./LICENSE) 文件为准。

## 当前功能

- 自然语言创建测试运行，生成测试计划并进入执行流程
- 审批工具调用、处理澄清问题，并继续对话
- 记录证据与缺陷草稿，集中展示测试监控信息
- 侧边栏查看最近会话，支持恢复、分叉、继续、重命名、打标签和删除
- 内置 SDK 控制面板，可直接编辑 Claude Agent SDK 的 Base URL、API Key 和模型
- 以 Claude Desktop 风格布局展示对话区、会话区和测试监控台

## 技术栈

Electron · Vite · React 19 · TypeScript · Vitest · React Testing Library · Playwright · electron-builder · lucide-react · zod · Claude Agent SDK

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行开发模式

`npm run dev` 会先启动 Vite 开发服务器，再自动打开 Electron 桌面应用。

```bash
npm run dev
```

如果只想启动前端 Web 服务，使用：

```bash
npm run dev:web
```

如果你想手动打开 Electron 窗口并连接到 Vite 开发服务器，也可以在另一个终端里设置 `VITE_DEV_SERVER_URL`：

```powershell
$env:VITE_DEV_SERVER_URL="http://127.0.0.1:5173"
npm run electron
```

### 3. 运行构建产物

```bash
npm run build
npm run electron
```

如果没有设置 `VITE_DEV_SERVER_URL`，`electron` 会直接加载 `dist/index.html`。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 并打开 Electron 桌面应用 |
| `npm run dev:web` | 仅启动 Vite 开发服务器 |
| `npm run electron` | 启动 Electron 应用 |
| `npm run build` | 类型检查 + Vite 生产构建 |
| `npm run build:electron` | 仅编译 Electron 主进程和 preload |
| `npm test` | 运行全部单元和组件测试 |
| `npm test -- <path>` | 运行指定测试文件 |
| `npm run test:watch` | 测试监听模式 |
| `npm run e2e` | Playwright 端到端测试 |
| `npm run pack` | 打包为免安装目录 |
| `npm run dist` | 打包为平台安装器 |
| `npm run pack:cn` | 打包（使用中国镜像加速） |
| `npm run dist:cn` | 打包为安装器（使用中国镜像加速） |

## 配置 Claude Agent SDK

应用不会直接读取 `AI_TEST_LLM_*` 这类环境变量。当前实现使用 Claude Agent SDK 的原生配置文件：

- `.claude/settings.json`
- `.claude/settings.local.json`

应用内的 **SDK 控制** 面板会保存以下字段：

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_MODEL`

规则如下：

- 当 `settings.local.json` 存在时，保存优先写入 `settings.local.json`
- 当两个文件都不存在时，首次启动会自动创建一个最小的 `.claude/settings.json`
- `Base URL` 不能是官方 Anthropic 域名

示例配置：

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-gateway.example.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your-token",
    "ANTHROPIC_MODEL": "claude-sonnet-4"
  }
}
```

## 打包发布

```bash
npm run dist:cn     # 生成 Windows 安装器 → release/
npm run pack:cn     # 生成免安装目录 → release/win-unpacked/
```

macOS 和 Linux 构建需在对应平台执行。

## 项目结构

### Electron 主进程与 SDK 运行时

```
electron/
├── main.ts                   # Electron 主进程入口
├── preload.ts                # preload 入口
├── preloadApi.ts             # 安全 API 暴露列表
└── agent/
    ├── agentConfig.ts        # SDK 运行配置、环境清理和本地二进制定位
    ├── agentSessionManager.ts # 会话、审批、MCP、任务与 SDK 控制集中管理
    ├── approvalBridge.ts      # canUseTool / AskUserQuestion 审批桥接
    ├── asyncMessageQueue.ts   # 流式消息队列
    ├── backendRuntime.ts      # 后端运行时组合入口
    ├── claudeAgentRuntimeAdapter.ts  # SDK query() 包装
    ├── claudeAgentSdkFacade.ts # SDK 导入边界
    ├── claudeConfigDir.ts     # CLAUDE_CONFIG_DIR 解析
    ├── runEventMapper.ts      # SDK 消息 → RunEvent 映射
    └── sdkSettings.ts         # `.claude/settings*.json` 读写
```

### 渲染进程与 UI

```
src/
├── app/
│   ├── App.tsx               # 应用根组件
│   ├── backendBridge.ts      # 渲染进程侧 IPC 封装
│   ├── sdkEventStore.ts      # SDK UI 事件状态管理
│   ├── sdkUiTypes.ts         # UI 状态类型
│   └── components/
│       ├── ClaudeSidebar.tsx # 左侧导航与最近会话
│       ├── ConversationPane.tsx # 对话主区域
│       ├── Composer.tsx     # 输入区
│       ├── MessageStream.tsx # 消息流
│       ├── TestConsole.tsx   # 测试监控台
│       ├── SessionPanel.tsx  # SDK 会话面板
│       └── SdkControlDrawer.tsx # SDK 控制面板
├── domain/
│   └── testRun.ts            # 事件溯源测试运行领域模型
├── ipc/
│   ├── channels.ts
│   └── payloadSchemas.ts     # IPC 通道和 zod 校验
└── ui/
    └── styles.css            # 全局样式
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

## Git 提交规范

提交信息使用中文，格式：`<类型>: <简要描述>`，例如 `feat: 添加测试运行领域模型`、`fix: 修复事件排序问题`。
