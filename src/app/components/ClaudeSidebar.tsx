import { ChevronDown, Folder, MessageSquare, Plus, Sparkles } from "lucide-react";
import type { SessionSummary } from "../sdkUiTypes";

type Props = {
  activeRunId?: string;
  sessions: SessionSummary[];
  onNewChat: () => void;
  onResumeSession: (sessionId: string) => void;
};

export function ClaudeSidebar({ activeRunId, sessions, onNewChat, onResumeSession }: Props) {
  return (
    <aside className="claude-sidebar" aria-label="会话导航">
      <div className="claude-brand">
        <Sparkles aria-hidden="true" className="claude-brand-icon" size={23} />
        <span>AI 测试助手</span>
      </div>
      <nav className="claude-nav" aria-label="主导航">
        <button className="claude-nav-item" type="button" onClick={onNewChat}>
          <Plus aria-hidden="true" size={18} />
          新建聊天
        </button>
        <button className="claude-nav-item active" type="button">
          <MessageSquare aria-hidden="true" size={18} />
          对话
        </button>
        <button className="claude-nav-item" type="button">
          <Folder aria-hidden="true" size={18} />
          项目
        </button>
      </nav>
      <div className="recent-section">
        <p className="recent-title">最近</p>
        {sessions.length === 0 ? <p className="recent-empty">暂无最近对话</p> : null}
        {sessions.map((session) => (
          <button
            className={session.id === activeRunId ? "recent-session active" : "recent-session"}
            key={session.id}
            type="button"
            onClick={() => onResumeSession(session.id)}
          >
            {session.title}
          </button>
        ))}
      </div>
      <div className="claude-profile">
        <span className="profile-avatar">测</span>
        <span className="profile-copy">
          <strong>测试人员</strong>
          <span>专业版</span>
        </span>
        <ChevronDown aria-hidden="true" size={16} />
      </div>
    </aside>
  );
}
