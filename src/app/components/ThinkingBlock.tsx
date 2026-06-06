import { useState } from "react";
import { ActivityIndicator } from "./ActivityIndicator";

type Props = {
  duration: string;
  children: React.ReactNode;
  complete?: boolean;
};

export function ThinkingBlock({ duration, children, complete = false }: Props) {
  const [open, setOpen] = useState(false);
  const hasVisibleContent = String(children ?? "").trim().length > 0;
  const isComplete = complete || (!hasVisibleContent && duration.trim().length > 0);
  const indicatorStatus = isComplete ? "done" : hasVisibleContent ? "active" : "done";

  return (
    <div className={`thinking-block tool-call-card ${isComplete ? "is-complete" : ""}`}>
      <div className="tool-call-body thinking-call-body">
        <div className="tool-call-header">
          <ActivityIndicator status={indicatorStatus} />
          <span className="tool-call-tool-name">Thinking</span>
          {hasVisibleContent ? (
            <button
              className={`tool-call-toggle thinking-toggle ${open ? "expanded" : ""}`}
              type="button"
              aria-label={open ? "收起思考" : "展开思考"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <svg
                aria-hidden="true"
                className="chevron-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {open ? <polyline points="6 9 12 15 18 9" /> : <polyline points="8 6 14 12 8 18" />}
              </svg>
            </button>
          ) : null}
          <span className="tool-call-status">{duration}</span>
        </div>
        {hasVisibleContent ? (
          <div className={`thinking-detail ${open ? "open" : ""}`} hidden={!open}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
