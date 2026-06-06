import { Folder, MessageSquare, Plus, Settings, Sparkles } from "lucide-react";
import type { SessionSummary } from "../sdkUiTypes";

type Props = {
  activeRunId?: string;
  activeNav?: "conversation" | "projects";
  sessions: SessionSummary[];
  onNewChat: () => void;
  onSelectConversation: () => void;
  onSelectProjects: () => void;
  onResumeSession: (sessionId: string) => void;
  onSettingsClick: () => void;
};

export function ClaudeSidebar({ activeRunId, activeNav = "conversation", sessions, onNewChat, onSelectConversation, onSelectProjects, onResumeSession, onSettingsClick }: Props) {
  return (
    <aside className="claude-sidebar" aria-label="会话导航">
      <div className="claude-brand">
        <Sparkles aria-hidden="true" className="claude-brand-icon" size={22} />
        <span>AI 测试助手</span>
      </div>
      <nav className="claude-nav" aria-label="主导航">
        <button className="claude-nav-item" type="button" onClick={onNewChat}>
          <Plus aria-hidden="true" size={18} />
          新建聊天
        </button>
        <button
          aria-current={activeNav === "conversation" ? "page" : undefined}
          className={activeNav === "conversation" ? "claude-nav-item active" : "claude-nav-item"}
          type="button"
          onClick={onSelectConversation}
        >
          <MessageSquare aria-hidden="true" size={18} />
          对话
        </button>
        <button
          aria-current={activeNav === "projects" ? "page" : undefined}
          className={activeNav === "projects" ? "claude-nav-item active" : "claude-nav-item"}
          type="button"
          onClick={onSelectProjects}
        >
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
      <div className="claude-sidebar-footer">
        <button type="button" onClick={onSettingsClick}>
          <Settings aria-hidden="true" size={16} />
          设置
        </button>
      </div>
    </aside>
  );
}
