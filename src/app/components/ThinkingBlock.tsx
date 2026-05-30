import { useState } from "react";
import { ActivityIndicator } from "./ActivityIndicator";

type Props = {
  duration: string;
  children: React.ReactNode;
};

export function ThinkingBlock({ duration, children }: Props) {
  const [open, setOpen] = useState(false);
  const hasVisibleContent = String(children ?? "").trim().length > 0;
  const label = hasVisibleContent ? "思考中…" : "思考已完成";

  return (
    <div className="thinking-block">
      <div
        className={`thinking-header ${open ? "expanded" : ""}`}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ActivityIndicator status={hasVisibleContent ? "active" : "done"} />
        <span className="thinking-label">{label}</span>
        <span className="thinking-time">{duration}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {hasVisibleContent ? (
        <div className={`thinking-body ${open ? "open" : ""}`} hidden={!open}>{children}</div>
      ) : null}
    </div>
  );
}
