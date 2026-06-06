import { Copy, RefreshCcw, Sparkles, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallCard } from "./ToolCallCard";
import type { ConversationEntry, SdkUiState } from "../sdkUiTypes";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolApprovalCard } from "./ToolApprovalCard";
import type { ToolCall } from "../../domain/testRun";

type Props = {
  state: SdkUiState;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
  onAnswer: (runId: string, requestId: string, answers: Record<string, unknown>) => void;
  onCopyMessage: (content: string) => void;
  onRetryMessage: (content: string) => void;
};

function toolCallStatusText(status: ToolCall["status"]) {
  switch (status) {
    case "running":
      return "执行中…";
    case "waiting_approval":
      return "等待审批";
    case "completed":
      return "已完成";
    case "failed":
      return "执行失败";
    case "skipped":
      return "已跳过";
    default:
      return "等待中…";
  }
}

function toolCallCardStatus(status: ToolCall["status"]) {
  switch (status) {
    case "completed":
      return "done";
    case "failed":
      return "error";
    default:
      return "active";
  }
}

function buildToolCallTranscript(toolCall: ToolCall, progress?: { status: string; progress?: unknown }) {
  const lines = [`调用工具：${toolCall.toolName}`];
  const label = toolCall.label.trim();
  const input = (toolCall.streamedInput ?? toolCall.inputSummary ?? "").trim();

  const normalizedToolName = toolCall.toolName.trim().toLowerCase();
  if (normalizedToolName === "read") {
    if (label) {
      lines.push(`目标文件：${label}`);
    }
    if (input && input !== label) {
      lines.push(`读取范围：${input}`);
    }
    if (toolCall.outputSummary?.trim()) {
      lines.push(`返回内容：${toolCall.outputSummary.trim()}`);
    }
  } else if (normalizedToolName === "write") {
    if (label) {
      lines.push(`目标文件：${label}`);
    }
    if (input && input !== label) {
      lines.push(`写入目标：${input}`);
    }
    if (toolCall.outputSummary?.trim()) {
      lines.push(`写入内容：${toolCall.outputSummary.trim()}`);
    }
  } else {
    if (label && label !== toolCall.toolName) {
      lines.push(`工具标签：${label}`);
    }
    if (input) {
      lines.push(`输入：${input}`);
    }
    if (toolCall.outputSummary?.trim()) {
      lines.push(`输出：${toolCall.outputSummary.trim()}`);
    }
  }

  if (typeof progress?.progress === "string" && progress.progress.trim()) {
    lines.push(`进度：${progress.progress.trim()}`);
  }
  if (toolCall.approvalReason?.trim()) {
    lines.push(`审批原因：${toolCall.approvalReason.trim()}`);
  }
  return lines.join("\n");
}

function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="message-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function MessageStream({ state, onApprove, onDeny, onAnswer, onCopyMessage, onRetryMessage }: Props) {
  const toolCalls = (state.toolCalls ?? []).filter((toolCall) => toolCall.status !== "waiting_approval");
  const conversationEntries = state.conversationEntries ?? [];
  const hasConversationTimeline = conversationEntries.length > 0;

  function renderAssistantMessage(message: Extract<ConversationEntry, { kind: "assistant-message" }>) {
    return (
      <article className="message assistant-message" key={message.id}>
        <Sparkles aria-hidden="true" className="assistant-mark" size={22} />
        <div className="assistant-content">
          {message.thinkingContent || message.thinkingDuration ? (
            <ThinkingBlock duration={message.thinkingDuration ?? ""} complete={message.complete}>
              {message.thinkingContent ?? ""}
            </ThinkingBlock>
          ) : null}
          <MessageMarkdown content={message.content} />
          <div className="assistant-actions">
            <button aria-label="复制回复" type="button" onClick={() => onCopyMessage(message.content)}><Copy aria-hidden="true" size={14} />复制</button>
            <button aria-label="重试回复" type="button" onClick={() => onRetryMessage(message.content)}><RefreshCcw aria-hidden="true" size={14} />重试</button>
          </div>
        </div>
      </article>
    );
  }

  function renderTimelineEntry(entry: ConversationEntry) {
    if (entry.kind === "user-message") {
      return (
        <article className="message user-message" key={entry.id}>
          <div className="user-bubble">{entry.content}</div>
        </article>
      );
    }

    if (entry.kind === "assistant-message") {
      return renderAssistantMessage(entry);
    }

    if (entry.kind === "tool-call") {
      const progress = state.toolProgress.get(entry.toolCall.id);
      return (
        <ToolCallCard
          key={entry.id}
          toolName={entry.toolCall.toolName}
          summary={entry.toolCall.streamedInput?.trim() || entry.toolCall.inputSummary?.trim() || entry.toolCall.label || entry.toolCall.toolName}
          status={toolCallCardStatus(entry.toolCall.status)}
          statusText={toolCallStatusText(entry.toolCall.status)}
          output={buildToolCallTranscript(entry.toolCall, progress)}
          streamedInput={entry.toolCall.streamedInput ?? entry.toolCall.inputSummary}
          toolProgress={progress}
        />
      );
    }

    if (entry.kind === "approval") {
      return (
        <ToolApprovalCard
          key={entry.id}
          request={entry.request}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      );
    }

    return (
      <AskUserQuestionCard
        key={entry.id}
        request={entry.request}
        onAnswer={onAnswer}
      />
    );
  }

  return (
    <div className="message-column">
      {state.rateLimitInfo ? (
        <div className="rate-limit-banner" role="alert">
          <AlertTriangle aria-hidden="true" className="rate-limit-icon" size={18} />
          <div className="rate-limit-text">
            <span className="rate-limit-title">API 速率限制</span>
            <span className="rate-limit-detail">
              {(state.rateLimitInfo as Record<string, unknown>).tokensRemaining != null
                ? `剩余 token: ${(state.rateLimitInfo as Record<string, unknown>).tokensRemaining}`
                : "请求频率过高，请稍后重试"}
            </span>
          </div>
        </div>
      ) : null}
      {hasConversationTimeline
        ? conversationEntries.map((entry) => renderTimelineEntry(entry))
        : (
          <>
            {state.messages.map((message) => (
              <article className={`message ${message.role}-message`} key={message.id}>
                {message.role === "assistant" ? (
                  <>
                    <Sparkles aria-hidden="true" className="assistant-mark" size={22} />
                    <div className="assistant-content">
                      {message.thinkingContent || message.thinkingDuration ? (
                        <ThinkingBlock duration={message.thinkingDuration ?? ""} complete={message.complete}>
                          {message.thinkingContent ?? ""}
                        </ThinkingBlock>
                      ) : null}
                      <MessageMarkdown content={message.content} />
                      <div className="assistant-actions">
                        <button aria-label="复制回复" type="button" onClick={() => onCopyMessage(message.content)}><Copy aria-hidden="true" size={14} />复制</button>
                        <button aria-label="重试回复" type="button" onClick={() => onRetryMessage(message.content)}><RefreshCcw aria-hidden="true" size={14} />重试</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="user-bubble">{message.content}</div>
                )}
              </article>
            ))}
            {toolCalls.length ? (
              <div className="tool-call-stream" aria-label="工具调用过程">
                {toolCalls.map((toolCall) => {
                  const progress = state.toolProgress.get(toolCall.id);
                  return (
                    <ToolCallCard
                      key={toolCall.id}
                      toolName={toolCall.toolName}
                      summary={toolCall.streamedInput?.trim() || toolCall.inputSummary?.trim() || toolCall.label || toolCall.toolName}
                      status={toolCallCardStatus(toolCall.status)}
                      statusText={toolCallStatusText(toolCall.status)}
                      output={buildToolCallTranscript(toolCall, progress)}
                      streamedInput={toolCall.streamedInput ?? toolCall.inputSummary}
                      toolProgress={progress}
                    />
                  );
                })}
              </div>
            ) : null}
            {state.approvals.map((request) => (
              <ToolApprovalCard key={request.requestId} request={request} onApprove={onApprove} onDeny={onDeny} />
            ))}
            {state.questions.map((request) => (
              <AskUserQuestionCard key={request.requestId} request={request} onAnswer={onAnswer} />
            ))}
          </>
        )}
      {state.notifications.map((n, i) => (
        <div className="system-notification" key={`notif-${i}`} data-notification-type={n.notificationType}>
          {n.title ? <strong>{n.title}: </strong> : null}{n.message}
        </div>
      ))}
      {state.errors.map((error, index) => <p className="sdk-error" key={`${error.message}-${index}`}>{error.message}</p>)}
      {state.tasks.map((task) => <p className="sdk-task" key={task.taskId}>{task.summary ?? task.taskId}</p>)}
    </div>
  );
}
