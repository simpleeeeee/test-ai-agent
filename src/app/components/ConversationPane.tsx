import type { SdkUiState } from "../sdkUiTypes";
import { Composer } from "./Composer";
import { EmptyConversationState } from "./EmptyConversationState";
import { MessageStream } from "./MessageStream";
import { WindowControls } from "./WindowControls";

type Props = {
  state: SdkUiState;
  title: string;
  composerValue: string;
  hasTestExecution: boolean;
  activeRunId?: string;
  loadingHistorySession?: boolean;
  modelName?: string;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
  onCopyMessage: (content: string) => void;
  onRetryMessage: (content: string) => void;
  onApprovePlan: () => void;
  onComposerChange: (value: string) => void;
  onComposerSubmit: (value: string) => void;
  onAddContent: () => void;
  onMinimizeWindow: () => void;
  onToggleMaximizeWindow: () => void;
  onCloseWindow: () => void;
};

export function ConversationPane({
  state,
  title,
  composerValue,
  hasTestExecution,
  activeRunId,
  loadingHistorySession,
  modelName = "Claude Sonnet 4.6",
  onApprove,
  onDeny,
  onAnswer,
  onCopyMessage,
  onRetryMessage,
  onApprovePlan,
  onComposerChange,
  onComposerSubmit,
  onAddContent,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
}: Props) {
  const isEmpty = state.messages.length === 0 && state.approvals.length === 0 && state.questions.length === 0 && state.errors.length === 0;
  const placeholder = hasTestExecution ? "补充测试指令或继续提问…" : "向 AI 测试助手提问…";
  const shouldShowPlanApproval = activeRunId ? state.runStatuses?.[activeRunId] === "waiting_confirmation" : false;

  return (
    <main className="conversation" aria-label="对话">
      <header className="conversation-header">
        <span className="conversation-title">{title}</span>
        <div className="conversation-header-actions">
          <WindowControls
            onMinimize={onMinimizeWindow}
            onToggleMaximize={onToggleMaximizeWindow}
            onClose={onCloseWindow}
          />
        </div>
      </header>
      <section className="message-stream" aria-label="消息流">
        {loadingHistorySession ? (
          <div className="history-loading-banner" role="status" aria-live="polite" aria-label="正在加载历史会话">
            <span className="history-loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="history-loading-copy">正在加载历史会话…</span>
          </div>
        ) : isEmpty ? (
          <EmptyConversationState onSuggestionClick={onComposerChange} />
        ) : (
          <>
            <MessageStream
              state={state}
              onApprove={onApprove}
              onDeny={onDeny}
              onAnswer={onAnswer}
              onCopyMessage={onCopyMessage}
              onRetryMessage={onRetryMessage}
            />
            {shouldShowPlanApproval ? (
              <div className="plan-action-row">
                <button className="primary-action" type="button" onClick={onApprovePlan}>
                  确认计划并执行
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
      <Composer value={composerValue} onChange={onComposerChange} onSubmit={onComposerSubmit} onAddContent={onAddContent} placeholder={placeholder} modelName={modelName} usage={state.usage} />
    </main>
  );
}
