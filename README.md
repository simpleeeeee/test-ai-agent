# AI 测试助手

AI 测试助手是一个面向中文测试人员的桌面端测试辅助应用。用户可以用中文自然语言输入测试需求，例如“测试订单模块功能”，应用会围绕该需求生成测试运行数据，并为后续的测试计划确认、工具调用、证据记录和缺陷草稿生成提供基础能力。

## ⚠️ 重要声明
此仓库代码仅供 **个人学习、面试评估、技术交流** 使用。  
严禁任何个人或组织在 **生产环境、商业产品或内部工具中** 直接运行或集成。
如需商用授权，请邮件联系：zuhang.meng@gmail.com

> 本项目的具体许可条款，请以仓库根目录下的 [LICENSE](./LICENSE) 文件为准。

## 运行方式

安装依赖：

```bash
npm install
```

运行测试：

```bash
npm test
```

启动开发服务：

```bash
npm run dev
```

构建项目：

```bash
npm run build
```

运行端到端测试：

```bash
npm run e2e
```

启动 Electron：

```bash
npm run electron
```

如果当前终端没有 `npm`，但依赖已经安装，可以直接调用本地工具：

```powershell
node .\node_modules\vitest\vitest.mjs run
node .\node_modules\typescript\bin\tsc -p tsconfig.json
```
