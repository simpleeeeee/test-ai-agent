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

export function SessionPanel({
  runId,
  sessions,
  bridge,
  onRefresh,
}: {
  runId: string;
  sessions: SessionSummary[];
  bridge: SessionBridge;
  onRefresh?: () => void;
}) {
  return (
    <aside className="session-panel" aria-label="SDK 会话">
      <button type="button" onClick={() => bridge.listSessions().then(() => onRefresh?.())}>刷新会话</button>
      {sessions.map((session) => (
        <section key={session.id}>
          <h3>{session.title}</h3>
          <p>{session.id}</p>
          {session.tags.length > 0 ? <p>{session.tags.join(", ")}</p> : null}
          <button type="button" onClick={() => bridge.getSession(session.id)}>查看</button>
          <button type="button" onClick={() => bridge.resumeSession(runId, session.id)}>恢复</button>
          <button type="button" onClick={() => bridge.forkSession(runId, session.id)}>Fork</button>
          <button type="button" onClick={() => bridge.continueRun(runId)}>继续</button>
          <button type="button" onClick={() => bridge.renameSession(session.id, `${session.title} 已更新`).then(() => onRefresh?.())}>重命名</button>
          <button type="button" onClick={() => bridge.tagSession(session.id, "reviewed").then(() => onRefresh?.())}>打标签</button>
          <button type="button" onClick={() => bridge.deleteSession(session.id).then(() => onRefresh?.())}>删除</button>
        </section>
      ))}
    </aside>
  );
}
