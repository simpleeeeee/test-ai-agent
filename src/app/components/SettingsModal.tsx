import { useState } from "react";

type Props = {
  bridge: { loadSettings: () => Promise<unknown>; saveSettings: (s: unknown) => unknown };
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
  connectionStatus?: {
    state: string;
    baseUrl: string;
    model: string;
    error?: { code: string; message: string; suggestion: string };
    probedAt: number;
  };
};

const NAV_ITEMS = [
  { key: "connection", icon: "🔗", label: "连接" },
  { key: "conversation", icon: "💬", label: "对话" },
  { key: "appearance", icon: "🎨", label: "外观" },
  { key: "security", icon: "🛡", label: "安全" },
  { key: "output", icon: "📋", label: "输出" },
  { key: "debug", icon: "🔧", label: "调试" },
] as const;

export function SettingsModal({ bridge, onClose, theme, onThemeChange, connectionStatus }: Props) {
  const [activeNav, setActiveNav] = useState("connection");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [permissionMode, setPermissionMode] = useState("default");
  const [thinkingEffort, setThinkingEffort] = useState("medium");
  const [thinkingDisplay, setThinkingDisplay] = useState("summarized");
  const [effort, setEffort] = useState("high");
  const [maxTurns, setMaxTurns] = useState(50);
  const [maxBudgetUsd, setMaxBudgetUsd] = useState(5);

  function handleSave(overrides?: Record<string, unknown>) {
    bridge.saveSettings({ baseUrl, apiKey, model, effort, ...overrides } as Parameters<typeof bridge.saveSettings>[0]);
  }

  return (
    <div className="settings-modal-overlay" role="presentation" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>设置</h2>
          <button className="settings-modal-close" title="关闭" onClick={onClose}>✕</button>
        </div>
        <div className="settings-modal-body">
          <nav className="settings-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                className={activeNav === item.key ? "settings-nav-item active" : "settings-nav-item"}
                onClick={() => setActiveNav(item.key)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {activeNav === "connection" && (
              <div className="settings-section">
                <div className="settings-section-title">API 连接配置</div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">Base URL</span>
                    <span className="settings-field-hint">Anthropic API 端点地址</span>
                  </div>
                  <input className="settings-input" type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.anthropic.com" />
                </div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">API Key</span>
                    <span className="settings-field-hint">用于身份验证的 API 密钥</span>
                  </div>
                  <input className="settings-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-api-..." />
                </div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">模型</span>
                    <span className="settings-field-hint">默认使用的 Claude 模型</span>
                  </div>
                  <input className="settings-input" type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4-6" />
                </div>
              </div>
            )}
            {activeNav === "connection" && connectionStatus && (
              <div className="settings-section">
                <div className="settings-section-title">连接状态</div>
                <div className="settings-field">
                  <div
                    className={`settings-conn-status${connectionStatus.state === "connected" ? " connected" : ""}`}
                    onClick={() => connectionStatus.state === "failed" && setShowConnectionError(!showConnectionError)}
                    role={connectionStatus.state === "failed" ? "button" : undefined}
                    aria-expanded={connectionStatus.state === "failed" ? showConnectionError : undefined}
                    style={connectionStatus.state === "failed" ? { cursor: "pointer" } : undefined}
                  >
                    <span className="conn-dot" />
                    <span>
                      {connectionStatus.state === "connected" ? "已连接" :
                       connectionStatus.state === "unverified" ? "未验证" :
                       connectionStatus.state === "connecting" ? "验证中..." :
                       connectionStatus.state === "failed" ? "连接失败" : "未验证"}
                    </span>
                    {connectionStatus.state === "connected" && <> 至 {connectionStatus.model}</>}
                  </div>
                  <button className="settings-btn">测试连接</button>
                </div>
                {showConnectionError && connectionStatus.error && (
                  <div className="settings-conn-error" role="region" aria-label="连接错误详情">
                    <p>{connectionStatus.error.message}</p>
                    <p className="conn-error-suggestion">{connectionStatus.error.suggestion}</p>
                  </div>
                )}
              </div>
            )}
            {activeNav === "appearance" && (
              <div className="settings-section">
                <div className="settings-section-title">界面外观</div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">主题模式</span>
                    <span className="settings-field-hint">切换浅色 / 暗色界面</span>
                  </div>
                  <div className="settings-toggle">
                    <button
                      className={`settings-toggle-btn${theme === "light" ? " active" : ""}`}
                      onClick={() => onThemeChange("light")}
                    >浅色</button>
                    <button
                      className={`settings-toggle-btn${theme === "dark" ? " active" : ""}`}
                      onClick={() => onThemeChange("dark")}
                    >暗色</button>
                  </div>
                </div>
              </div>
            )}
            {activeNav === "conversation" && (
              <>
                <div className="settings-section">
                  <div className="settings-section-title">SDK 会话配置</div>
                  <div className="settings-field">
                    <div className="settings-field-label-group">
                      <label className="settings-field-label" htmlFor="sdk-permission-mode">权限模式</label>
                      <span className="settings-field-hint">控制工具调用的授权行为</span>
                    </div>
                    <select id="sdk-permission-mode" className="settings-select" aria-label="权限模式"
                      value={permissionMode} onChange={(e) => setPermissionMode(e.target.value)}>
                      <option value="default">default</option>
                      <option value="acceptEdits">acceptEdits</option>
                      <option value="bypassPermissions">bypassPermissions</option>
                      <option value="plan">plan</option>
                    </select>
                  </div>
                  <div className="settings-field">
                    <div className="settings-field-label-group">
                      <label className="settings-field-label" htmlFor="sdk-thinking-effort">思考强度</label>
                      <span className="settings-field-hint">扩展思考的深度级别</span>
                    </div>
                    <select id="sdk-thinking-effort" className="settings-select" aria-label="思考强度"
                      value={thinkingEffort} onChange={(e) => setThinkingEffort(e.target.value)}>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="xhigh">xhigh</option>
                      <option value="max">max</option>
                    </select>
                  </div>
                  <div className="settings-field">
                    <div className="settings-field-label-group">
                      <label className="settings-field-label" htmlFor="sdk-thinking-display">Thinking 展示</label>
                      <span className="settings-field-hint">思考过程的展示方式</span>
                    </div>
                    <select id="sdk-thinking-display" className="settings-select" aria-label="Thinking 展示"
                      value={thinkingDisplay} onChange={(e) => setThinkingDisplay(e.target.value)}>
                      <option value="summarized">summarized</option>
                      <option value="omitted">omitted</option>
                    </select>
                  </div>
                  <div className="settings-field">
                    <div className="settings-field-label-group">
                      <label className="settings-field-label" htmlFor="sdk-effort">推理努力程度</label>
                      <span className="settings-field-hint">控制模型推理深度</span>
                    </div>
                    <select id="sdk-effort" className="settings-select" aria-label="推理努力程度"
                      value={effort} onChange={(e) => { setEffort(e.target.value); handleSave({ effort: e.target.value }); }}>
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                      <option value="xhigh">极高</option>
                      <option value="max">最大</option>
                    </select>
                  </div>
                </div>
                <div className="settings-section">
                  <div className="settings-section-title">限制</div>
                  <div className="settings-field">
                    <div className="settings-field-label-group">
                      <label className="settings-field-label" htmlFor="max-turns">最大对话轮数</label>
                      <span className="settings-field-hint">单次会话允许的最大轮数 (1–100)</span>
                    </div>
                    <input id="max-turns" className="settings-input-number" type="number" min={1} max={100}
                      value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} />
                  </div>
                  <div className="settings-field">
                    <div className="settings-field-label-group">
                      <label className="settings-field-label" htmlFor="max-budget">成本上限 (USD)</label>
                      <span className="settings-field-hint">单次会话的费用上限</span>
                    </div>
                    <input id="max-budget" className="settings-input-number" type="number" min={0.01} step={0.01}
                      value={maxBudgetUsd} onChange={(e) => setMaxBudgetUsd(Number(e.target.value))} />
                  </div>
                </div>
                <div className="settings-actions">
                  <button className="settings-btn primary" type="button">应用设置</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
