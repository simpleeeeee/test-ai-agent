import type { SessionSummary } from "../sdkUiTypes";

type SessionBridge = {
  listSessions: () => unknown;
  getSession: (sessionId: string) => unknown;
  resumeSession: (runId: string, sessionId: string) => unknown;
  forkSession: (runId: string, sessionId: string) => unknown;
  continueRun: (runId: string) => unknown;
  renameSession: (sessionId: string, title: string) => unknown;
  tagSession: (sessionId: string, tag: string) => unknown;
  deleteSession: (sessionId: string) => unknown;
};

export function SessionPanel({ runId, sessions, bridge }: { runId: string; sessions: SessionSummary[]; bridge: SessionBridge }) {
  return (
    <aside className="session-panel" aria-label="SDK 会话">
      <button type="button" onClick={() => bridge.listSessions()}>刷新会话</button>
      {sessions.map((session) => (
        <section key={session.id}>
          <h3>{session.title}</h3>
          <p>{session.id}</p>
          <p>{session.tags.join(", ")}</p>
          <button type="button" onClick={() => bridge.getSession(session.id)}>查看</button>
          <button type="button" onClick={() => bridge.resumeSession(runId, session.id)}>恢复</button>
          <button type="button" onClick={() => bridge.forkSession(runId, session.id)}>Fork</button>
          <button type="button" onClick={() => bridge.continueRun(runId)}>继续</button>
          <button type="button" onClick={() => bridge.renameSession(session.id, `${session.title} 已更新`)}>重命名</button>
          <button type="button" onClick={() => bridge.tagSession(session.id, "reviewed")}>打标签</button>
          <button type="button" onClick={() => bridge.deleteSession(session.id)}>删除</button>
        </section>
      ))}
    </aside>
  );
}
