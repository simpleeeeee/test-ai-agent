import { Copy, RefreshCcw, Sparkles } from "lucide-react";
import type { SdkUiState } from "../sdkUiTypes";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import { ToolApprovalCard } from "./ToolApprovalCard";

type Props = {
  state: SdkUiState;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
  onCopyMessage: (content: string) => void;
  onRetryMessage: (content: string) => void;
};

export function MessageStream({ state, onApprove, onDeny, onAnswer, onCopyMessage, onRetryMessage }: Props) {
  return (
    <div className="message-column">
      {state.messages.map((message) => (
        <article className={`message ${message.role}-message`} key={message.id}>
          {message.role === "assistant" ? (
            <>
              <Sparkles aria-hidden="true" className="assistant-mark" size={22} />
              <div>
                <p>{message.content}</p>
                <div className="assistant-actions">
                  <button aria-label="复制回复" type="button" onClick={() => onCopyMessage(message.content)}><Copy aria-hidden="true" size={14} />复制</button>
                  <button aria-label="重试回复" type="button" onClick={() => onRetryMessage(message.content)}><RefreshCcw aria-hidden="true" size={14} />重试</button>
                </div>
              </div>
            </>
          ) : (
            <div className="user-bubble">
              <span className="profile-avatar">测</span>
              <span>{message.content}</span>
            </div>
          )}
        </article>
      ))}
      {state.approvals.map((request) => (
        <ToolApprovalCard key={request.requestId} request={request} onApprove={onApprove} onDeny={onDeny} />
      ))}
      {state.questions.map((request) => (
        <AskUserQuestionCard key={request.requestId} request={request} onAnswer={onAnswer} />
      ))}
      {state.errors.map((error, index) => <p className="sdk-error" key={`${error.message}-${index}`}>{error.message}</p>)}
      {state.tasks.map((task) => <p className="sdk-task" key={task.taskId}>{task.summary ?? task.taskId}</p>)}
    </div>
  );
}
