import type { SdkUiState } from "../sdkUiTypes";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import { ToolApprovalCard } from "./ToolApprovalCard";

type Props = {
  state: SdkUiState;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
};

export function MessageStream({ state, onApprove, onDeny, onAnswer }: Props) {
  return (
    <section className="message-stream" aria-label="消息流">
      {state.messages.map((message) => (
        <article className={`message ${message.role}-message`} key={message.id}>{message.content}</article>
      ))}
      {state.approvals.map((request) => (
        <ToolApprovalCard key={request.requestId} request={request} onApprove={onApprove} onDeny={onDeny} />
      ))}
      {state.questions.map((request) => (
        <AskUserQuestionCard key={request.requestId} request={request} onAnswer={onAnswer} />
      ))}
      {state.mcpServers.length ? (
        <section className="sdk-status-list" aria-label="MCP 状态">
          {state.mcpServers.map((server) => <span key={server.name}>{server.name} {server.status}</span>)}
        </section>
      ) : null}
      {state.errors.map((error, index) => <p className="sdk-error" key={`${error.message}-${index}`}>{error.message}</p>)}
      {state.tasks.map((task) => <p className="sdk-task" key={task.taskId}>{task.summary ?? task.taskId}</p>)}
      {state.usage ? <details><summary>SDK Usage</summary><pre>{JSON.stringify(state.usage, null, 2)}</pre></details> : null}
      {state.rawMessages.map((raw, index) => (
        <details key={index}>
          <summary>SDK Raw Message {index + 1}</summary>
          <pre>{JSON.stringify(raw, null, 2)}</pre>
        </details>
      ))}
    </section>
  );
}
