import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { ApprovalRequest } from "../sdkUiTypes";

type Props = {
  request: ApprovalRequest;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
};

function inputSummary(request: ApprovalRequest) {
  const summary = request.toolCall.inputSummary?.trim();
  if (summary) {
    return `工具：${request.toolCall.toolName}\n${summary}`;
  }
  return `工具：${request.toolCall.toolName}\n操作：等待工具输入摘要`;
}

function approvalReason(request: ApprovalRequest) {
  return request.toolCall.approvalReason?.trim() || `${request.toolCall.label} 请求执行工具调用。`;
}

export function ToolApprovalCard({ request, onApprove, onDeny }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [decision, setDecision] = useState<"pending" | "allow-once" | "allow-session" | "denied">("pending");
  const disabled = decision !== "pending";

  function approve(applyPermissionSuggestions: boolean) {
    onApprove(request.runId, request.requestId, {
      updatedInput: undefined,
      applyPermissionSuggestions,
    });
    setDecision(applyPermissionSuggestions ? "allow-session" : "allow-once");
  }

  function deny() {
    const message = denyReason.trim() || "用户拒绝了此次工具调用";
    onDeny(request.runId, request.requestId, message);
    setDecision("denied");
  }

  const statusLabel = decision === "allow-once"
    ? "已允许一次"
    : decision === "allow-session"
      ? "已在本会话允许"
      : decision === "denied"
        ? "已拒绝"
        : "等待审核";

  return (
    <section className={disabled ? "message review-card completed" : "message review-card"} aria-label="需要审核工具调用">
      <div className="review-head">
        <div className="review-icon" aria-hidden="true">
          <ShieldCheck size={17} />
        </div>
        <div className="review-copy">
          <strong>AI 测试助手想使用{request.toolCall.label}</strong>
          <span>需要你审核后才能继续执行</span>
        </div>
        <span className="review-status">{statusLabel}</span>
      </div>
      <p className="review-summary">{approvalReason(request)}</p>
      <pre className="review-code">{inputSummary(request)}</pre>
      <p className="review-impact">影响范围：会访问当前测试环境页面，并把结果写入本次会话证据。</p>
      <button className="review-detail" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "收起详情" : "查看详情"}
        {expanded ? <ChevronUp aria-hidden="true" size={13} /> : <ChevronDown aria-hidden="true" size={13} />}
      </button>
      {expanded ? (
        <pre className="review-code" aria-label="原始工具输入">{JSON.stringify(request.toolCall, null, 2)}</pre>
      ) : null}
      <label className="deny-reason">
        拒绝原因
        <input value={denyReason} onChange={(event) => setDenyReason(event.currentTarget.value)} disabled={disabled} />
      </label>
      <div className="review-actions">
        <button className="review-button primary" type="button" onClick={() => approve(false)} disabled={disabled}>允许一次</button>
        <button className="review-button session" type="button" onClick={() => approve(true)} disabled={disabled}>本会话允许</button>
        <button className="review-button deny" type="button" onClick={deny} disabled={disabled}>拒绝</button>
      </div>
    </section>
  );
}
