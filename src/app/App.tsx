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
