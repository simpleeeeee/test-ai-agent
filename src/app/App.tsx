import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createBackendBridge } from "./backendBridge";
import { createInitialSdkUiState, reduceSdkUiEvent } from "./sdkEventStore";
import { ClaudeSidebar } from "./components/ClaudeSidebar";
import { ConversationPane } from "./components/ConversationPane";
import { TestConsole } from "./components/TestConsole";
import { SettingsModal } from "./components/SettingsModal";
import type { Evidence } from "../domain/testRun";
import type { SdkMessage, SessionSummary } from "./sdkUiTypes";
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
      const msgId = "msg-1";
      setTimeout(() => {
        emitFallback("run:created", { runId, prompt });
        emitFallback("assistant:thinking-delta", { runId, messageId: msgId, delta: "分析用户需求…" });
        emitFallback("assistant:thinking-delta", { runId, messageId: msgId, delta: "匹配测试策略…" });
        emitFallback("assistant:text-delta", { runId, messageId: msgId, delta: `已根据"${prompt}"生成测试计划，请审核后点击确认执行。` });
        emitFallback("assistant:message-completed", { runId, messageId: msgId, thinkingDuration: "2s" });
        emitFallback("sdk:usage", { runId, raw: { input_tokens: 1132, output_tokens: 423, cache_read_input_tokens: 580, context_tokens: 2100, max_context_tokens: 25000 } });
        emitFallback("sdk:task-progress", { runId, taskId: "task-1", summary: "等待审核测试计划" });
        emitFallback("sdk:mcp-status", { runId, servers: [{ name: "browser", status: "connected" }, { name: "api", status: "pending" }] });
      }, 0);
    } else if (channel === "run:approve-plan") {
      const runId = (payload as { runId?: string })?.runId ?? "run-1";
      const msgId = `msg-${Date.now()}`;
      setTimeout(() => {
        emitFallback("sdk:task-progress", { runId, taskId: "task-2", summary: "执行测试计划中…" });
        emitFallback("assistant:text-delta", { runId, messageId: msgId, delta: "计划已确认，开始执行测试。" });
        emitFallback("assistant:message-completed", { runId, messageId: msgId });
        emitFallback("sdk:usage", { runId, raw: { input_tokens: 2458, output_tokens: 847, cache_read_input_tokens: 1230, context_tokens: 3200, max_context_tokens: 25000 } });
      }, 0);
    } else if (channel === "run:send-message") {
      const runId = (payload as { runId?: string })?.runId ?? "run-1";
      const message = (payload as { message?: string })?.message ?? "";
      const msgId = `msg-${Date.now()}`;
      setTimeout(() => {
        emitFallback("assistant:text-delta", { runId, messageId: msgId, delta: `已收到补充指令："${message}"，继续执行测试。` });
        emitFallback("assistant:message-completed", { runId, messageId: msgId });
        emitFallback("sdk:usage", { runId, raw: { input_tokens: 3670, output_tokens: 1102, context_tokens: 4300, max_context_tokens: 25000 } });
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

function extractSessionText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text.trim();
  if (typeof record.content === "string") return record.content.trim();
  if (Array.isArray(record.content)) {
    return record.content.map((block) => extractSessionText(block)).join("").trim();
  }
  if (Array.isArray(record.message)) {
    return record.message.map((block) => extractSessionText(block)).join("").trim();
  }
  if (record.message) return extractSessionText(record.message);
  return "";
}

function mapSessionMessages(raw: unknown): SdkMessage[] {
  if (!Array.isArray(raw)) return [];

  const messages: SdkMessage[] = [];
  for (const item of raw as Array<Record<string, unknown>>) {
    if (item.type !== "user" && item.type !== "assistant") continue;
    const content = extractSessionText(item.message);
    if (!content) continue;
    messages.push({
      id: typeof item.uuid === "string" ? item.uuid : `${item.type}-${messages.length}`,
      role: item.type,
      content,
      complete: true,
    });
  }
  return messages;
}

export function App() {
  const [composerValue, setComposerValue] = useState("");
  const [utilityPanel, setUtilityPanel] = useState<"projects" | null>(null);
  const [composerNotice, setComposerNotice] = useState("");
  const [pendingTestExecutionIntent, setPendingTestExecutionIntent] = useState(false);
  const [historyLoadingSessionId, setHistoryLoadingSessionId] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settingsModel, setSettingsModel] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<{
    state: string;
    baseUrl: string;
    model: string;
    error?: { code: string; message: string; suggestion: string };
    probedAt: number;
  } | undefined>();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const [state, dispatch] = useReducer(reduceSdkUiEvent, undefined, createInitialSdkUiState);
  const historyRestoreToken = useRef(0);
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

  useEffect(() => {
    bridge.loadSettings().then((s) => {
      setSettingsModel((s.model as string) || "");
      setTheme((s.theme as "light" | "dark") || "light");
      setConnectionStatus({
        state: "unverified",
        baseUrl: (s.baseUrl as string) || "",
        model: (s.model as string) || "",
        probedAt: Date.now(),
      });
    }).catch(() => {});
  }, [bridge]);

  const requestRunId = state.activeRunId ?? "run-1";
  const activeTaskId = state.tasks.at(-1)?.taskId;
  const hasActiveConversation = !!state.activeRunId;
  const shouldShowTestConsole = !!state.activeRunId && !!state.workspaceModes[state.activeRunId]?.hasTestExecution;
  const title = state.sessions.find((session) => session.id === state.activeRunId)?.title ?? state.activeRunId ?? "新对话";

  useEffect(() => bridge.subscribe(dispatch), [bridge]);

  useEffect(() => {
    if (!pendingTestExecutionIntent || !state.activeRunId) return;
    dispatch({ channel: "ui:test-execution-confirmed", payload: { runId: state.activeRunId } });
    setPendingTestExecutionIntent(false);
  }, [pendingTestExecutionIntent, state.activeRunId]);


  function handleComposerSubmit(value: string) {
    const userMessageId = `user-${crypto.randomUUID()}`;
    dispatch({ channel: "ui:user-message-sent", payload: { messageId: userMessageId, content: value } });

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
    historyRestoreToken.current += 1;
    setHistoryLoadingSessionId(undefined);
    dispatch({ channel: "ui:new-chat" });
    setComposerValue("");
    setComposerNotice("");
    setPendingTestExecutionIntent(false);
    setSettingsOpen(false);
    closeUtilityPanels();
  }

  function handleSelectConversation() {
    closeUtilityPanels();
    setSettingsOpen(false);
  }

  function handleResumeSession(sessionId: string) {
    const restoreToken = ++historyRestoreToken.current;
    const previousRunId = state.activeRunId;
    setHistoryLoadingSessionId(sessionId);
    dispatch({
      channel: "ui:session-loaded",
      payload: { sessionId, messages: [] },
    });
    setComposerValue("");
    setComposerNotice("");
    setPendingTestExecutionIntent(false);
    closeUtilityPanels();

    if (previousRunId && previousRunId !== sessionId) {
      bridge.stopRun(previousRunId);
    }

    void bridge.getSessionMessages(sessionId)
      .then((raw) => {
        if (historyRestoreToken.current !== restoreToken) return;
        dispatch({
          channel: "ui:session-loaded",
          payload: {
            sessionId,
            messages: mapSessionMessages(raw),
          },
        });
        setHistoryLoadingSessionId((current) => (current === sessionId ? undefined : current));
      })
      .catch(() => {
        if (historyRestoreToken.current === restoreToken) {
          setHistoryLoadingSessionId((current) => (current === sessionId ? undefined : current));
        }
      })
      .finally(() => {
        if (historyRestoreToken.current !== restoreToken) return;
        bridge.resumeSession(sessionId, sessionId).then(() => {
          refreshSessions();
        }).catch(() => {});
      });
  }

  function handleSelectProjects() {
    setUtilityPanel("projects");
    setComposerNotice("");
  }

  function handleAddContent() {
    closeUtilityPanels();
    setComposerNotice("添加内容功能即将开放");
  }

  function handleApplySdkSettings(runId: string, settings: Record<string, unknown>) {
    bridge.applySettings(runId, settings);
  }

  return (
    <div className={shouldShowTestConsole ? "app-shell test-mode" : "app-shell chat-mode"}>
      <ClaudeSidebar
        activeRunId={state.activeRunId}
        sessions={state.sessions}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onSelectProjects={handleSelectProjects}
        onResumeSession={handleResumeSession}
        onSettingsClick={() => setSettingsOpen((v) => !v)}
      />
      <ConversationPane
        state={state}
        title={title}
        composerValue={composerValue}
        hasTestExecution={shouldShowTestConsole}
        activeRunId={state.activeRunId}
        loadingHistorySession={historyLoadingSessionId !== undefined && historyLoadingSessionId === state.activeRunId}
        modelName={settingsModel || undefined}
        onApprove={bridge.approveTool}
        onDeny={bridge.denyTool}
        onAnswer={bridge.answerQuestion}
        onCopyMessage={(content) => { navigator.clipboard?.writeText(content); }}
        onRetryMessage={(content) => { bridge.sendMessage(requestRunId, content); }}
        onApprovePlan={handleApprovePlan}
        onComposerChange={setComposerValue}
        onComposerSubmit={handleComposerSubmit}
        onAddContent={handleAddContent}
        onMinimizeWindow={bridge.minimizeWindow}
        onToggleMaximizeWindow={bridge.toggleMaximizeWindow}
        onCloseWindow={bridge.closeWindow}
      />
      {utilityPanel === "projects" ? (
        <aside className="utility-panel" aria-label="项目面板">
          <h2>项目面板</h2>
          <p>项目管理入口已就绪，后续可在这里接入项目列表和测试资产。</p>
        </aside>
      ) : null}
      {composerNotice ? <div className="composer-notice" role="status">{composerNotice}</div> : null}
      {settingsOpen ? (
        <SettingsModal
          bridge={bridge}
          onClose={() => setSettingsOpen(false)}
          onThemeChange={(mode) => setTheme(mode)}
          theme={theme}
          activeRunId={state.activeRunId}
          onApplySettings={handleApplySdkSettings}
          connectionStatus={connectionStatus}
        />
      ) : null}
      {shouldShowTestConsole ? (
        <TestConsole
          activeTaskId={activeTaskId}
          mcpServers={state.mcpServers}
          tasks={state.tasks}
          taskNotifications={state.taskNotifications}
          evidence={(state.evidence ?? []) as Evidence[]}
          bugDraft={undefined}
          onApprovePlan={handleApprovePlan}
          onStopTask={(taskId: string) => { bridge.stopTask(requestRunId, taskId); }}
        />
      ) : null}

    </div>
  );
}
