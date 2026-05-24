import { useEffect, useMemo, useReducer, useState } from "react";
import { createBackendBridge } from "./backendBridge";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";
import { ClaudeSidebar } from "./components/ClaudeSidebar";
import { Composer } from "./components/Composer";
import { MessageStream } from "./components/MessageStream";
import { TestConsole } from "./components/TestConsole";
import "../ui/styles.css";

const fallbackApi = {
  send: () => undefined,
  invoke: () => Promise.resolve(undefined),
  on: () => () => undefined,
};

let chatInstance = 0;

export function App() {
  const [chatKey, setChatKey] = useState(0);
  const [composerValue, setComposerValue] = useState("");
  const [state, dispatch] = useReducer(reduceSdkUiEvent, undefined, createInitialSdkUiState);
  const bridge = useMemo(() => createBackendBridge(window.aiTestAssistant ?? fallbackApi), []);
  const activeRunId = state.activeRunId;
  const activeTaskId = state.tasks.at(-1)?.taskId;
  const shouldShowTestConsole = Boolean(activeRunId && state.workspaceModes[activeRunId]?.hasTestExecution);

  useEffect(() => bridge.subscribe(dispatch), [bridge]);

  function handleNewChat() {
    chatInstance += 1;
    setChatKey(chatInstance);
  }

  function handleComposerSubmit(value: string) {
    if (activeRunId) {
      bridge.sendMessage(activeRunId, value);
    } else {
      bridge.createRun(value);
    }
    setComposerValue("");
  }

  function handleApprovePlan() {
    const runId = activeRunId ?? "run-1";
    dispatch({ channel: "ui:test-execution-confirmed", payload: { runId } });
    bridge.approvePlan(runId);
  }

  return (
    <div key={chatKey} className={shouldShowTestConsole ? "app-shell test-mode" : "app-shell chat-mode"}>
      <ClaudeSidebar
        activeRunId={activeRunId}
        sessions={state.sessions}
        onNewChat={handleNewChat}
        onResumeSession={(sessionId) => activeRunId && bridge.resumeSession(activeRunId, sessionId)}
        onViewAll={() => bridge.listSessions()}
      />
      <main className="conversation" aria-label="对话">
        <header className="conversation-header">
          <button className="conversation-title" type="button">
            {activeRunId ?? "新对话"}
          </button>
        </header>
        <MessageStream
          state={state}
          onApprove={bridge.approveTool}
          onDeny={bridge.denyTool}
          onAnswer={bridge.answerQuestion}
          onCopyMessage={(content) => { navigator.clipboard?.writeText(content); }}
          onRetryMessage={(messageId) => { bridge.sendMessage(activeRunId ?? "", messageId); }}
        />
        {activeRunId ? (
          <div className="plan-action-row">
            <button className="primary-action" type="button" onClick={handleApprovePlan}>
              确认计划并执行
            </button>
          </div>
        ) : null}
        <Composer value={composerValue} onChange={setComposerValue} onSubmit={handleComposerSubmit} />
      </main>
      {shouldShowTestConsole ? (
        <TestConsole
          activeTaskId={activeTaskId}
          mcpServers={state.mcpServers}
          tasks={state.tasks}
          evidence={state.evidence}
          bugDraft={state.bugDraft}
          onApprovePlan={handleApprovePlan}
          onStopTask={(taskId) => activeRunId && bridge.stopTask(activeRunId, taskId)}
        />
      ) : null}
    </div>
  );
}
