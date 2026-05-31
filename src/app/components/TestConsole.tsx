import type { Evidence, BugDraft } from "../../domain/testRun";
import type { McpServerUiStatus, SdkTaskProgress } from "../sdkUiTypes";

type Props = {
  activeTaskId?: string;
  mcpServers: McpServerUiStatus[];
  tasks: SdkTaskProgress[];
  taskNotifications: Array<{ taskId: string; status: string; description?: string }>;
  evidence: Evidence[];
  bugDraft?: BugDraft;
  onApprovePlan: () => void;
  onStopTask: (taskId: string) => void;
};

function evidenceSummary(evidence: Evidence[]) {
  const screenshots = evidence.filter((item) => item.type === "screenshot").length;
  const logs = evidence.filter((item) => item.type === "log").length;
  return `截图 ${screenshots} 张 · 日志 ${logs} 条`;
}

function progress(tasks: SdkTaskProgress[]) {
  const current = Math.min(tasks.length, 5);
  return {
    text: `${current} / 5 个场景 · ${tasks.at(-1)?.summary ?? "等待执行测试计划"}`,
    width: `${current * 20}%`,
  };
}

function mcpServerDisplayName(name: string): string {
  const mapping: Record<string, string> = {
    browser: "浏览器",
    api: "接口",
    auth: "认证",
  };
  return mapping[name] ?? name;
}

function mcpStatusLabel(status: string): string {
  const mapping: Record<string, string> = {
    connected: "已连接",
    failed: "连接失败",
    "needs-auth": "需要授权",
    pending: "等待中",
    disabled: "已禁用",
  };
  return mapping[status] ?? status;
}

export function TestConsole({
  activeTaskId,
  mcpServers,
  tasks,
  taskNotifications,
  evidence,
  bugDraft,
  onApprovePlan,
  onStopTask,
}: Props) {
  const currentProgress = progress(tasks);

  return (
    <aside className="test-console" role="complementary" aria-label="测试监控台">
      <header className="test-console-header">
        <h2>测试监控台</h2>
      </header>

      <section className="monitor-card">
        <h3>计划进度</h3>
        <div className="progress" aria-label="测试进度">
          <span style={{ width: currentProgress.width }} />
        </div>
        <p>{currentProgress.text}</p>
      </section>

      <section className="monitor-card">
        <h3>MCP 服务</h3>
        <ul className="mcp-server-list">
          {mcpServers.map((server) => (
            <li key={server.name} className="mcp-server-row">
              <span className="mcp-server-name">{mcpServerDisplayName(server.name)}</span>
              <span className="mcp-server-status">{mcpStatusLabel(server.status)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="monitor-card">
        <h3>证据</h3>
        <p>{evidenceSummary(evidence)}</p>
      </section>

      <section className="monitor-card">
        <h3>任务</h3>
        {tasks.map((task) => (
          <p className="sdk-task" key={task.taskId}>
            {task.summary ?? task.taskId}
            {task.status ? (
              <span className={`task-status-label status-${task.status}`}>
                {task.status === "started" ? "启动" : task.status === "updated" ? "更新中" : task.status}
              </span>
            ) : null}
          </p>
        ))}
        {taskNotifications.map((n, i) => (
          <div className="task-notification-item" key={`tn-${i}`}>
            <div className="task-notification-header">
              <span>{n.taskId}</span>
              <span className="task-notification-status" style={{
                color: n.status === "completed" ? "var(--green)" : n.status === "failed" ? "var(--red)" : "var(--text-secondary)"
              }}>
                {n.status}
              </span>
            </div>
            {n.description ? <p className="monitor-row">{n.description}</p> : null}
          </div>
        ))}
      </section>

      {bugDraft ? (
        <section className="monitor-card">
          <h3>缺陷草稿</h3>
          <p className="bug-draft-title">{bugDraft.title}</p>
          <span className="bug-draft-severity">{bugDraft.severity}</span>
        </section>
      ) : null}

      <footer className="test-console-footer">
        <button className="primary-action" type="button" onClick={onApprovePlan}>
          确认执行
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={() => activeTaskId && onStopTask(activeTaskId)}
        >
          停止
        </button>
      </footer>
    </aside>
  );
}
