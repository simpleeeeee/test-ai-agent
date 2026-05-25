import { useEffect, useMemo, useReducer, useState } from "react";
import { createBackendBridge } from "./backendBridge";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";
import { ConversationPane } from "./components/ConversationPane";
import { McpStatusPanel } from "./components/McpStatusPanel";
import { SdkControlDrawer } from "./components/SdkControlDrawer";
import { SessionPanel } from "./components/SessionPanel";
import { Plus, Settings } from "lucide-react";
import "../ui/styles.css";

const fallbackApi = {
  send: () => undefined,
  invoke: () => Promise.resolve(undefined),
  on: () => () => undefined,
};

export function App() {
  const [composerValue, setComposerValue] = useState("");
  const [controlOpen, setControlOpen] = useState(false);
  const [state, dispatch] = useReducer(reduceSdkUiEvent, undefined, createInitialSdkUiState);
  const bridge = useMemo(() => createBackendBridge(window.aiTestAssistant ?? fallbackApi), []);
  const activeRunId = state.activeRunId ?? "run-1";
  const activeTaskId = state.tasks.at(-1)?.taskId;
  const shouldShowTestConsole = !!state.activeRunId;

  useEffect(() => bridge.subscribe(dispatch), [bridge]);

  function handleComposerSubmit(value: string) {
    if (shouldShowTestConsole) {
      bridge.sendMessage(activeRunId, value);
    } else {
      bridge.createRun(value);
    }
    setComposerValue("");
  }

  function handleApprovePlan() {
    bridge.approvePlan(activeRunId);
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
      <ConversationPane
        state={state}
        title={activeRunId ?? "新对话"}
        composerValue={composerValue}
        hasTestExecution={shouldShowTestConsole}
        activeRunId={activeRunId}
        onApprove={bridge.approveTool}
        onDeny={bridge.denyTool}
        onAnswer={bridge.answerQuestion}
        onCopyMessage={(content) => { navigator.clipboard?.writeText(content); }}
        onRetryMessage={(messageId) => { bridge.sendMessage(activeRunId, messageId); }}
        onApprovePlan={handleApprovePlan}
        onComposerChange={setComposerValue}
        onComposerSubmit={handleComposerSubmit}
        onMinimizeWindow={bridge.minimizeWindow}
        onToggleMaximizeWindow={bridge.toggleMaximizeWindow}
        onCloseWindow={bridge.closeWindow}
      />
      {controlOpen ? <SdkControlDrawer runId={activeRunId} activeTaskId={activeTaskId} bridge={bridge} /> : null}
    </div>
  );
}
