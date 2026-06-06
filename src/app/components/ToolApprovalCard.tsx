import { useState } from "react";
import { ActivityIndicator } from "./ActivityIndicator";
import type { ApprovalRequest } from "../sdkUiTypes";

type Props = {
  request: ApprovalRequest;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
};

function inputSummaryText(request: ApprovalRequest) {
  const summary = request.toolCall.inputSummary?.trim();
  if (summary) return `工具：${request.toolCall.toolName}\n${summary}`;
  return `工具：${request.toolCall.toolName}`;
}

export function ToolApprovalCard({ request, onApprove, onDeny }: Props) {
  const [selected, setSelected] = useState<"allow-once" | "allow-session" | "denied" | null>(null);

  function handleApprove(applyPermissionSuggestions: boolean) {
    setSelected(applyPermissionSuggestions ? "allow-session" : "allow-once");
    onApprove(request.runId, request.requestId, { updatedInput: undefined, applyPermissionSuggestions });
  }

  function handleDeny() {
    setSelected("denied");
    onDeny(request.runId, request.requestId, "用户拒绝了此次工具调用");
  }

  const indicatorStatus = selected === "denied" ? "error" : selected ? "done" : "active";

  return (
    <div className="approval-transcript" aria-label="审批中">
      <div className="term-line">
        <ActivityIndicator status={indicatorStatus} />
        <span className="term-prompt">$</span>
        <span className="term-text">ai-assistant request {request.toolCall.toolName}</span>
      </div>
      <div className="term-line">
        <span className="term-prompt">&gt;</span>
        <span className="term-text">{request.toolCall.approvalReason?.trim() || `${request.toolCall.label} 请求执行工具调用。`}</span>
      </div>
      <pre className="term-block">{inputSummaryText(request)}</pre>
      <div className="term-actions">
        <button
          className={`approval-btn ${selected === "allow-once" ? "is-selected" : ""}`}
          type="button"
          onClick={() => handleApprove(false)}
          disabled={selected !== null && selected !== "allow-once"}
        >
          允许一次
        </button>
        <button
          className={`approval-btn ${selected === "allow-session" ? "is-selected" : ""}`}
          type="button"
          onClick={() => handleApprove(true)}
          disabled={selected !== null && selected !== "allow-session"}
        >
          本会话允许
        </button>
        <button
          className={`approval-btn ${selected === "denied" ? "is-selected" : ""}`}
          type="button"
          onClick={handleDeny}
          disabled={selected !== null && selected !== "denied"}
        >
          拒绝
        </button>
      </div>
    </div>
  );
}
