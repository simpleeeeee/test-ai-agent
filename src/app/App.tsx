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
              aria-current={index === 0 ? "true" : undefined}
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
