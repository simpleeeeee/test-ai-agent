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
  toolProgress?: { status: string; progress?: unknown } | undefined;
};

function dedentBlock(text: string) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => (line.match(/^\s*/) || [""])[0].length);
  const indent = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(indent)).join("\n");
}

export function ToolCallCard({ toolName, summary, status, statusText, output, outputLabel = "调用过程", streamedInput, toolProgress }: Props) {
  const [open, setOpen] = useState(false);
  const inputPreview = streamedInput ?? summary;
  const outputText = output ? dedentBlock(output) : "";

  return (
    <div className="tool-call-card">
      <div className="tool-call-body">
        <div className="tool-call-header">
          <ActivityIndicator status={status} />
          <span className="tool-call-tool-name">{toolName}</span>
          <span className="tool-call-summary">{inputPreview}</span>
          <span className="tool-call-status">{statusText}</span>
        </div>
        {toolProgress && toolProgress.status === "running" ? (
          <div className="tool-call-progress">
            {typeof toolProgress.progress === "string" ? toolProgress.progress : "执行中…"}
          </div>
        ) : null}
        {output ? (
          <>
            <button
              className={`tool-call-toggle ${open ? "expanded" : ""}`}
              type="button"
              onClick={() => setOpen((v) => !v)}
            >
              <svg className="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {open ? <polyline points="6 9 12 15 18 9" /> : <polyline points="8 6 14 12 8 18" />}
              </svg>
              {outputLabel}
            </button>
            <pre className={`tool-call-detail ${open ? "open" : ""}`} hidden={!open}>{outputText}</pre>
          </>
        ) : null}
      </div>
    </div>
  );
}
