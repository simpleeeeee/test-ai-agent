import { useEffect, useMemo, useReducer, useState } from "react";
import { createBackendBridge } from "./backendBridge";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";
import { ClaudeSidebar } from "./components/ClaudeSidebar";
import { ConversationPane } from "./components/ConversationPane";
import { SdkControlDrawer } from "./components/SdkControlDrawer";
import { TestConsole } from "./components/TestConsole";
import type { Evidence } from "../domain/testRun";
import "../ui/styles.css";

const fallbackListeners = new Map<string, Array<(payload: unknown) => void>>();

function emitFallback(channel: string, payload: unknown) {
  const entries = fallbackListeners.get(channel);
  if (entries) {
    for (const fn of entries) fn(payload);
  }
}

const fallbackApi = {
  send: (channel: string, payload: unknown) => {
    if (channel === "run:create") {
      const prompt = (payload as { prompt?: string })?.prompt ?? "";
      const runId = "run-1";
      setTimeout(() => {
        emitFallback("run:created", { runId, prompt });
        emitFallback("assistant:text-delta", { runId, messageId: "msg-1", delta: `已根据"${prompt}"生成测试计划，请审核后点击确认执行。` });
        emitFallback("assistant:message-completed", { runId, messageId: "msg-1" });
        emitFallback("sdk:task-progress", { runId, taskId: "task-1", summary: "等待审核测试计划" });
        emitFallback("sdk:mcp-status", { runId, servers: [{ name: "browser", status: "connected" }, { name: "api", status: "pending" }] });
      }, 0);
    }
  },
  invoke: () => Promise.resolve(undefined),
  on: (channel: string, listener: (payload: unknown) => void) => {
    if (!fallbackListeners.has(channel)) {
      fallbackListeners.set(channel, []);
    }
    fallbackListeners.get(channel)!.push(listener);
    return () => {
      const arr = fallbackListeners.get(channel);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  },
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
    <div className={shouldShowTestConsole ? "app-shell test-mode" : "app-shell chat-mode"}>
      <ClaudeSidebar
        activeRunId={activeRunId}
        sessions={state.sessions}
        onNewChat={() => {
          setComposerValue("");
          setControlOpen(false);
        }}
        onResumeSession={() => {}}
      />
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
        onRetryMessage={(content) => { bridge.sendMessage(activeRunId, content); }}
        onApprovePlan={handleApprovePlan}
        onComposerChange={setComposerValue}
        onComposerSubmit={handleComposerSubmit}
        onMinimizeWindow={bridge.minimizeWindow}
        onToggleMaximizeWindow={bridge.toggleMaximizeWindow}
        onCloseWindow={bridge.closeWindow}
        onToggleSdkControl={() => setControlOpen((v) => !v)}
      />
      {shouldShowTestConsole ? (
        <TestConsole
          activeTaskId={activeTaskId}
          mcpServers={state.mcpServers}
          tasks={state.tasks}
          evidence={(state.evidence ?? []) as Evidence[]}
          bugDraft={undefined}
          onApprovePlan={handleApprovePlan}
          onStopTask={(taskId: string) => { bridge.stopTask(activeRunId, taskId); }}
        />
      ) : null}
      {controlOpen ? <SdkControlDrawer runId={activeRunId} activeTaskId={activeTaskId} bridge={bridge} /> : null}
    </div>
  );
}
