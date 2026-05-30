import { Plus, Send } from "lucide-react";
import type { TokenUsage } from "../sdkUiTypes";

function formatTokens(n: number): string {
  if (n >= 1000) {
    return (Math.floor(n / 100) / 10).toFixed(1) + "k";
  }
  return String(n);
}

function getCacheTokens(usage: TokenUsage): number {
  return (usage.cacheCreationInputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0);
}

function hasTokenStats(usage?: TokenUsage): usage is TokenUsage {
  if (!usage) return false;
  return (
    usage.inputTokens !== undefined ||
    usage.outputTokens !== undefined ||
    usage.contextTokens !== undefined
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAddContent: () => void;
  placeholder: string;
  modelName?: string;
  usage?: TokenUsage;
};

export function Composer({
  value,
  onChange,
  onSubmit,
  onAddContent,
  placeholder,
  modelName,
  usage,
}: Props) {
  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  const showInfoBar = modelName !== undefined || hasTokenStats(usage);
  const cacheTokens = usage ? getCacheTokens(usage) : 0;
  const showCache = cacheTokens > 0;
  const contextPct =
    usage?.contextTokens !== undefined && usage?.maxContextTokens !== undefined && usage.maxContextTokens > 0
      ? Math.min(usage.contextTokens / usage.maxContextTokens, 1)
      : undefined;

  return (
    <div className="composer-wrapper">
      <form
        className={showInfoBar ? "composer-shell has-info-bar" : "composer-shell"}
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <textarea
          aria-label="消息输入"
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          value={value}
        />
        <div className="composer-toolbar">
          <div className="composer-tools">
            <button className="icon-button" type="button" aria-label="添加内容" title="添加内容" onClick={onAddContent}>
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>
          <button className="composer-send" type="submit" aria-label="发送">
            <Send aria-hidden="true" size={16} />
          </button>
        </div>
      </form>
      {showInfoBar ? (
        <div className="composer-info-bar">
          <span className="composer-info-model">{modelName ?? ""}</span>
          {hasTokenStats(usage) ? (
            <div className="composer-info-tokens">
              {usage.inputTokens !== undefined ? (
                <span className="composer-token-item">
                  <span aria-hidden="true">↘</span>{" "}
                  <strong>{formatTokens(usage.inputTokens)}</strong>
                </span>
              ) : null}
              {usage.outputTokens !== undefined ? (
                <span className="composer-token-item">
                  <span aria-hidden="true">↗</span>{" "}
                  <strong>{formatTokens(usage.outputTokens)}</strong>
                </span>
              ) : null}
              {showCache ? (
                <span className="composer-token-item cache-hit">
                  <span aria-hidden="true">⚡</span>{" "}
                  <strong>{formatTokens(cacheTokens)}</strong>
                </span>
              ) : null}
              {usage.contextTokens !== undefined ? (
                <span className="composer-token-item context-zone">
                  <span>context</span>{" "}
                  <strong>{formatTokens(usage.contextTokens)}</strong>
                  {contextPct !== undefined ? (
                    <span className="composer-context-bar" aria-hidden="true">
                      <span
                        className="composer-context-fill"
                        style={{ width: `${(contextPct * 100).toFixed(0)}%` }}
                      />
                    </span>
                  ) : null}
                  <span className="composer-context-tooltip">
                    <div className="tooltip-heading">当前会话 tokens 总量</div>
                    <div>
                      已用{" "}
                      {usage.contextTokens!.toLocaleString()}
                      {" / "}
                      {usage.maxContextTokens?.toLocaleString() ?? "--"}{" "}
                      tokens
                    </div>
                    {contextPct !== undefined ? (
                      <div className="tooltip-progress">
                        <span
                          className="tooltip-progress-fill"
                          style={{ width: `${(contextPct * 100).toFixed(0)}%` }}
                        />
                      </div>
                    ) : null}
                    {usage.maxContextTokens !== undefined ? (
                      <div className="tooltip-capacity">
                        LLM 单会话最大容量：{(usage.maxContextTokens / 1000).toFixed(0)}k tokens
                      </div>
                    ) : null}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
