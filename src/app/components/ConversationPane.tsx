import { Settings } from "lucide-react";
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
  onOpenTools: () => void;
  onOpenModelSettings: () => void;
  onMinimizeWindow: () => void;
  onToggleMaximizeWindow: () => void;
  onCloseWindow: () => void;
  onToggleSdkControl?: () => void;
};

export function ConversationPane({
  state,
  title,
  composerValue,
  hasTestExecution,
  activeRunId,
  modelName = "Claude Sonnet 4",
  onApprove,
  onDeny,
  onAnswer,
  onCopyMessage,
  onRetryMessage,
  onApprovePlan,
  onComposerChange,
  onComposerSubmit,
  onAddContent,
  onOpenTools,
  onOpenModelSettings,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
  onToggleSdkControl,
}: Props) {
  const isEmpty = state.messages.length === 0 && state.approvals.length === 0 && state.questions.length === 0 && state.errors.length === 0;
  const placeholder = hasTestExecution ? "补充测试指令或继续提问…" : "向 AI 测试助手提问…";

  return (
    <main className="conversation" aria-label="对话">
      <header className="conversation-header">
        <span className="conversation-title">{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onToggleSdkControl ? (
            <button className="window-control" type="button" aria-label="SDK 控制" title="SDK 控制" onClick={onToggleSdkControl}>
              <Settings aria-hidden="true" size={16} />
            </button>
          ) : null}
          <WindowControls
            onMinimize={onMinimizeWindow}
            onToggleMaximize={onToggleMaximizeWindow}
            onClose={onCloseWindow}
          />
        </div>
      </header>
      {isEmpty ? (
        <section className="message-stream" aria-label="消息流">
          <EmptyConversationState onSuggestionClick={onComposerChange} />
        </section>
      ) : (
        <section className="message-stream" aria-label="消息流">
          <MessageStream
            state={state}
            onApprove={onApprove}
            onDeny={onDeny}
            onAnswer={onAnswer}
            onCopyMessage={onCopyMessage}
            onRetryMessage={onRetryMessage}
          />
          {activeRunId ? (
            <div className="plan-action-row">
              <button className="primary-action" type="button" onClick={onApprovePlan}>
                确认计划并执行
              </button>
            </div>
          ) : null}
        </section>
      )}
      <Composer value={composerValue} onChange={onComposerChange} onSubmit={onComposerSubmit} onAddContent={onAddContent} onOpenTools={onOpenTools} onOpenModelSettings={onOpenModelSettings} placeholder={placeholder} modelName={modelName} />
    </main>
  );
}
