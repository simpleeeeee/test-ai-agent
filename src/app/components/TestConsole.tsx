import { MoreHorizontal } from "lucide-react";
import type { BugDraft, Evidence } from "../../domain/testRun";
import type { McpServerUiStatus, SdkTaskProgress } from "../sdkUiTypes";

type Props = {
  activeTaskId?: string;
  mcpServers: McpServerUiStatus[];
  tasks: SdkTaskProgress[];
  evidence: Evidence[];
  bugDraft?: BugDraft;
  onApprovePlan: () => void;
  onStopTask: (taskId: string) => void;
};

const statusLabels: Record<string, string> = {
  connected: "已连接",
  failed: "连接失败",
  "needs-auth": "需要授权",
  pending: "连接中",
  disabled: "已禁用",
};

const serverLabels: Record<string, string> = {
  browser: "浏览器",
  api: "接口",
  db: "数据库",
  auth: "认证",
};

export function TestConsole({ activeTaskId, mcpServers, tasks, evidence, bugDraft, onApprovePlan, onStopTask }: Props) {
  const latestTask = tasks.at(-1);

  return (
    <aside className="test-console" aria-label="测试监控台">
      <header className="test-console-header">
        <h2>测试监控台</h2>
        <button aria-label="更多测试操作" className="icon-button" type="button">
          <MoreHorizontal aria-hidden="true" size={18} />
        </button>
      </header>
      <div className="test-console-body">
        <section className="monitor-card">
          <h3>计划进度</h3>
          <p>{latestTask?.summary ?? "等待执行测试计划"}</p>
        </section>
        <section className="monitor-card">
          <h3>MCP 服务</h3>
          {mcpServers.map((server) => (
            <div className="monitor-row" key={server.name}>
              <span>{serverLabels[server.name] ?? server.name}</span>
              <span>{statusLabels[server.status] ?? server.status}</span>
            </div>
          ))}
        </section>
        <section className="monitor-card">
          <h3>证据</h3>
          <p>证据 {evidence.length} 条</p>
        </section>
        <section className="monitor-card">
          <h3>缺陷草稿</h3>
          <p>{bugDraft?.title ?? "暂无缺陷草稿"}</p>
        </section>
      </div>
      <footer className="test-console-footer">
        <button className="primary-action" type="button" onClick={onApprovePlan}>确认执行</button>
        <button className="secondary-action" disabled={!activeTaskId} type="button" onClick={() => activeTaskId && onStopTask(activeTaskId)}>停止</button>
      </footer>
    </aside>
  );
}
