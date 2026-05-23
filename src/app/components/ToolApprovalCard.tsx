import { useState } from "react";
import type { ApprovalRequest } from "../sdkUiTypes";

type Props = {
  request: ApprovalRequest;
  onApprove: (runId: string, requestId: string, options: { updatedInput?: Record<string, unknown>; applyPermissionSuggestions?: boolean }) => void;
  onDeny: (runId: string, requestId: string, message: string) => void;
};

export function ToolApprovalCard({ request, onApprove, onDeny }: Props) {
  const [inputText, setInputText] = useState("");
  const [applySuggestions, setApplySuggestions] = useState(false);
  const [parseError, setParseError] = useState("");

  function parseInput() {
    if (!inputText.trim()) return undefined;
    try {
      setParseError("");
      return JSON.parse(inputText) as Record<string, unknown>;
    } catch {
      setParseError("JSON 格式无效");
      return undefined;
    }
  }

  return (
    <section className="sdk-card approval-card" aria-label="工具授权请求">
      <div>
        <h3>{request.toolCall.label}</h3>
        <p className="mono">{request.toolCall.toolName}</p>
        {request.toolCall.approvalReason ? <p>{request.toolCall.approvalReason}</p> : null}
      </div>
      <label>
        调整后的工具输入
        <textarea value={inputText} onChange={(event) => setInputText(event.currentTarget.value)} />
        {parseError ? <span className="sdk-error">{parseError}</span> : null}
      </label>
      <label className="checkbox-line">
        <input type="checkbox" checked={applySuggestions} onChange={(event) => setApplySuggestions(event.currentTarget.checked)} />
        应用 SDK 权限建议
      </label>
      <div className="action-row">
        <button type="button" onClick={() => onApprove(request.runId, request.requestId, {
          updatedInput: parseInput(),
          applyPermissionSuggestions: applySuggestions,
        })}>
          允许并继续
        </button>
        <button type="button" onClick={() => onDeny(request.runId, request.requestId, "用户拒绝了工具调用")}>拒绝</button>
      </div>
    </section>
  );
}
