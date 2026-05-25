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
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
  onCopyMessage: (content: string) => void;
  onRetryMessage: (messageId: string) => void;
  onApprovePlan: () => void;
  onComposerChange: (value: string) => void;
  onComposerSubmit: (value: string) => void;
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
  onApprove,
  onDeny,
  onAnswer,
  onCopyMessage,
  onRetryMessage,
  onApprovePlan,
  onComposerChange,
  onComposerSubmit,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
}: Props) {
  const isEmpty = state.messages.length === 0 && state.approvals.length === 0 && state.questions.length === 0;
  const placeholder = hasTestExecution ? "补充测试指令或继续提问…" : "向 AI 测试助手提问…";

  return (
    <main className="conversation" aria-label="对话">
      <header className="conversation-header">
        <span className="conversation-title">{title}</span>
        <WindowControls
          onMinimize={onMinimizeWindow}
          onToggleMaximize={onToggleMaximizeWindow}
          onClose={onCloseWindow}
        />
      </header>
      {isEmpty ? (
        <section className="message-stream" aria-label="消息流">
          <EmptyConversationState />
        </section>
      ) : (
        <MessageStream
          state={state}
          onApprove={onApprove}
          onDeny={onDeny}
          onAnswer={onAnswer}
          onCopyMessage={onCopyMessage}
          onRetryMessage={onRetryMessage}
        />
      )}
      {activeRunId ? (
        <div className="plan-action-row">
          <button className="primary-action" type="button" onClick={onApprovePlan}>
            确认计划并执行
          </button>
        </div>
      ) : null}
      <Composer value={composerValue} onChange={onComposerChange} onSubmit={onComposerSubmit} placeholder={placeholder} />
    </main>
  );
}
