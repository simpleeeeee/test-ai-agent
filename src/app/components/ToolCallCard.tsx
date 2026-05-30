import { useState } from "react";
import { ActivityIndicator } from "./ActivityIndicator";

type Props = {
  toolName: string;
  summary: string;
  status: "idle" | "active" | "done" | "error";
  statusText: string;
  output?: string;
  outputLabel?: string;
  streamedInput?: string;
};

export function ToolCallCard({ toolName, summary, status, statusText, output, outputLabel = "查看输出", streamedInput }: Props) {
  const [open, setOpen] = useState(false);
  const inputPreview = streamedInput ?? summary;

  return (
    <div className="tool-call-card">
      <div className="tool-call-body">
        <div className="tool-call-header">
          <ActivityIndicator status={status} />
          <span className="tool-call-tool-name">{toolName}</span>
          <span className="tool-call-summary">{inputPreview}</span>
          <span className="tool-call-status">{statusText}</span>
        </div>
        {output ? (
          <>
            <button
              className={`tool-call-toggle ${open ? "expanded" : ""}`}
              type="button"
              onClick={() => setOpen((v) => !v)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {outputLabel}
            </button>
            <pre className={`tool-call-detail is-output ${open ? "open" : ""}`} hidden={!open}>{output}</pre>
          </>
        ) : null}
      </div>
    </div>
  );
}
