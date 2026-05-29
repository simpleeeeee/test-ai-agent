import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { createBackendBridge } from "./backendBridge";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";
import { ClaudeSidebar } from "./components/ClaudeSidebar";
import { ConversationPane } from "./components/ConversationPane";
import { SdkControlDrawer } from "./components/SdkControlDrawer";
import { TestConsole } from "./components/TestConsole";
import type { Evidence } from "../domain/testRun";
import type { SessionSummary } from "./sdkUiTypes";
import { isExplicitTestExecutionRequest } from "./testIntent";
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
    } else if (channel === "run:approve-plan") {
      const runId = (payload as { runId?: string })?.runId ?? "run-1";
      setTimeout(() => {
        emitFallback("sdk:task-progress", { runId, taskId: "task-2", summary: "执行测试计划中…" });
        emitFallback("assistant:text-delta", { runId, messageId: "msg-2", delta: "计划已确认，开始执行测试。" });
        emitFallback("assistant:message-completed", { runId, messageId: "msg-2" });
      }, 0);
    } else if (channel === "run:send-message") {
      const runId = (payload as { runId?: string })?.runId ?? "run-1";
      const message = (payload as { message?: string })?.message ?? "";
      setTimeout(() => {
        emitFallback("assistant:text-delta", { runId, messageId: `msg-${Date.now()}`, delta: `已收到补充指令："${message}"，继续执行测试。` });
        emitFallback("assistant:message-completed", { runId, messageId: `msg-${Date.now()}` });
        emitFallback("sdk:task-progress", { runId, taskId: `task-${Date.now()}`, summary: "已处理补充指令" });
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

function mapSdkSessions(raw: unknown): SessionSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: Record<string, unknown>) => ({
    id: (s.sessionId ?? s.id ?? "") as string,
    title: (s.customTitle || s.summary || s.firstPrompt || s.sessionId || "未命名会话") as string,
    tags: s.tag ? [s.tag as string] : [],
    lastModified: s.lastModified as number | undefined,
    createdAt: s.createdAt as number | undefined,
    summary: s.summary as string | undefined,
    gitBranch: s.gitBranch as string | undefined,
    cwd: s.cwd as string | undefined,
  }));
}

export function App() {
  const [composerValue, setComposerValue] = useState("");
  const [controlOpen, setControlOpen] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<"projects" | null>(null);
  const [composerNotice, setComposerNotice] = useState("");
  const [selectedModel, setSelectedModel] = useState("Claude Sonnet 4");
  const [pendingTestExecutionIntent, setPendingTestExecutionIntent] = useState(false);
  const [state, dispatch] = useReducer(reduceSdkUiEvent, undefined, createInitialSdkUiState);
  const bridge = useMemo(() => {
    const api = window.aiTestAssistant ?? fallbackApi;
    return createBackendBridge(api);
  }, []);

  const refreshSessions = useCallback(() => {
    bridge.listSessions().then((raw) => {
      dispatch({ channel: "ui:sessions-loaded", payload: { sessions: mapSdkSessions(raw) } });
    }).catch(() => {});
  }, [bridge]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const requestRunId = state.activeRunId ?? "run-1";
  const activeTaskId = state.tasks.at(-1)?.taskId;
  const hasActiveConversation = !!state.activeRunId;
  const shouldShowTestConsole = !!state.activeRunId && !!state.workspaceModes[state.activeRunId]?.hasTestExecution;
  const title = state.activeRunId ?? "新对话";

  useEffect(() => bridge.subscribe(dispatch), [bridge]);

  useEffect(() => {
    Promise.resolve(bridge.loadSettings()).then((settings) => {
      if (settings?.model) setSelectedModel(settings.model);
    }).catch(() => {});
  }, [bridge]);

  useEffect(() => {
    if (!pendingTestExecutionIntent || !state.activeRunId) return;
    dispatch({ channel: "ui:test-execution-confirmed", payload: { runId: state.activeRunId } });
    setPendingTestExecutionIntent(false);
  }, [pendingTestExecutionIntent, state.activeRunId]);

  function handleModelSaved(model: string) {
    if (model) setSelectedModel(model);
  }

  function handleComposerSubmit(value: string) {
    const isTestExecutionRequest = isExplicitTestExecutionRequest(value);
    if (hasActiveConversation) {
      if (isTestExecutionRequest && state.activeRunId) {
        dispatch({ channel: "ui:test-execution-confirmed", payload: { runId: state.activeRunId } });
      }
      bridge.sendMessage(requestRunId, value);
    } else {
      setPendingTestExecutionIntent(isTestExecutionRequest);
      bridge.createRun(value);
    }
    setComposerValue("");
    setComposerNotice("");
  }

  function handleApprovePlan() {
    bridge.approvePlan(requestRunId);
  }

  function closeUtilityPanels() {
    setUtilityPanel(null);
  }

  function handleNewChat() {
    dispatch({ channel: "ui:new-chat" });
    setComposerValue("");
    setComposerNotice("");
    setControlOpen(false);
    setPendingTestExecutionIntent(false);
    closeUtilityPanels();
  }

  function handleSelectConversation() {
    closeUtilityPanels();
    setControlOpen(false);
  }

  function handleSelectProjects() {
    setUtilityPanel("projects");
    setControlOpen(false);
    setComposerNotice("");
  }

  function handleAddContent() {
    closeUtilityPanels();
    setControlOpen(false);
    setComposerNotice("添加内容功能即将开放");
  }

  function handleOpenTools() {
    closeUtilityPanels();
    setControlOpen(false);
    setComposerNotice("工具面板即将开放");
  }

  function handleOpenModelSettings() {
    closeUtilityPanels();
    setComposerNotice("");
    setControlOpen(true);
  }

  return (
    <div className={shouldShowTestConsole ? "app-shell test-mode" : "app-shell chat-mode"}>
      <ClaudeSidebar
        activeRunId={state.activeRunId}
        sessions={state.sessions}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onSelectProjects={handleSelectProjects}
        onResumeSession={(sessionId) => {
          bridge.resumeSession(requestRunId, sessionId).then(() => {
            refreshSessions();
          }).catch(() => {});
        }}
      />
      <ConversationPane
        state={state}
        title={title}
        composerValue={composerValue}
        hasTestExecution={shouldShowTestConsole}
        activeRunId={state.activeRunId}
        modelName={selectedModel}
        onApprove={bridge.approveTool}
        onDeny={bridge.denyTool}
        onAnswer={bridge.answerQuestion}
        onCopyMessage={(content) => { navigator.clipboard?.writeText(content); }}
        onRetryMessage={(content) => { bridge.sendMessage(requestRunId, content); }}
        onApprovePlan={handleApprovePlan}
        onComposerChange={setComposerValue}
        onComposerSubmit={handleComposerSubmit}
        onAddContent={handleAddContent}
        onOpenTools={handleOpenTools}
        onOpenModelSettings={handleOpenModelSettings}
        onMinimizeWindow={bridge.minimizeWindow}
        onToggleMaximizeWindow={bridge.toggleMaximizeWindow}
        onCloseWindow={bridge.closeWindow}
        onToggleSdkControl={() => {
          closeUtilityPanels();
          setComposerNotice("");
          setControlOpen((v) => !v);
        }}
      />
      {utilityPanel === "projects" ? (
        <aside className="utility-panel" aria-label="项目面板">
          <h2>项目面板</h2>
          <p>项目管理入口已就绪，后续可在这里接入项目列表和测试资产。</p>
        </aside>
      ) : null}
      {composerNotice ? <div className="composer-notice" role="status">{composerNotice}</div> : null}
      {shouldShowTestConsole ? (
        <TestConsole
          activeTaskId={activeTaskId}
          mcpServers={state.mcpServers}
          tasks={state.tasks}
          evidence={(state.evidence ?? []) as Evidence[]}
          bugDraft={undefined}
          onApprovePlan={handleApprovePlan}
          onStopTask={(taskId: string) => { bridge.stopTask(requestRunId, taskId); }}
        />
      ) : null}
      {controlOpen ? <SdkControlDrawer bridge={bridge} onModelSaved={handleModelSaved} /> : null}
    </div>
  );
}
