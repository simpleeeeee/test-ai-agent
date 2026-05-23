import { FormEvent, useEffect, useMemo, useReducer, useState } from "react";
import { Plus, Send, Settings } from "lucide-react";
import { createBackendBridge } from "./backendBridge";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";
import { McpStatusPanel } from "./components/McpStatusPanel";
import { MessageStream } from "./components/MessageStream";
import { SdkControlDrawer } from "./components/SdkControlDrawer";
import { SessionPanel } from "./components/SessionPanel";
import "../ui/styles.css";

const fallbackApi = {
  send: () => undefined,
  invoke: () => Promise.resolve(undefined),
  on: () => () => undefined,
};

export function App() {
  const [prompt, setPrompt] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [controlOpen, setControlOpen] = useState(false);
  const [state, dispatch] = useReducer(reduceSdkUiEvent, undefined, createInitialSdkUiState);
  const bridge = useMemo(() => createBackendBridge(window.aiTestAssistant ?? fallbackApi), []);
  const activeRunId = state.activeRunId ?? "run-1";
  const activeTaskId = state.tasks.at(-1)?.taskId;

  useEffect(() => bridge.subscribe(dispatch), [bridge]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    bridge.createRun(trimmed);
    setPrompt("");
  }

  function handleFollowUp(event: FormEvent) {
    event.preventDefault();
    const trimmed = followUp.trim();
    if (!trimmed) return;
    bridge.sendMessage(activeRunId, trimmed);
    setFollowUp("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="会话列表">
        <div className="sidebar-header">
          <div className="app-title">AI 测试助手</div>
          <button className="new-test-button" type="button"><Plus size={16} />新建测试</button>
        </div>
        <SessionPanel runId={activeRunId} sessions={state.sessions} bridge={bridge} />
        <button className="settings-button" type="button" onClick={() => setControlOpen((value) => !value)}>
          <Settings size={16} />SDK 控制
        </button>
      </aside>
      <main className="conversation" aria-label="测试对话">
        <header className="conversation-header">
          <div>
            <p className="eyebrow">当前会话</p>
            <h1>{activeRunId}</h1>
          </div>
          <span className="status-chip">{state.errors.length ? "需要处理" : "就绪"}</span>
        </header>
        <MessageStream
          state={state}
          onApprove={bridge.approveTool}
          onDeny={bridge.denyTool}
          onAnswer={bridge.answerQuestion}
        />
        <McpStatusPanel runId={activeRunId} servers={state.mcpServers} bridge={bridge} />
        <div className="action-row">
          <button className="primary-action" type="button" onClick={() => bridge.approvePlan(activeRunId)}>
            确认计划并执行
          </button>
        </div>
        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            aria-label="测试目标"
            onChange={(event) => setPrompt(event.currentTarget.value)}
            placeholder="输入你想测试的功能，例如：测试订单模块功能"
            value={prompt}
          />
          <button className="send-button" type="submit"><Send size={16} />发送</button>
        </form>
        <form className="composer follow-up-composer" onSubmit={handleFollowUp}>
          <textarea
            aria-label="补充指令"
            onChange={(event) => setFollowUp(event.currentTarget.value)}
            placeholder="补充指令、调整计划或继续执行"
            value={followUp}
          />
          <button className="send-button" type="submit">发送补充</button>
        </form>
      </main>
      {controlOpen ? <SdkControlDrawer runId={activeRunId} activeTaskId={activeTaskId} bridge={bridge} /> : null}
    </div>
  );
}
