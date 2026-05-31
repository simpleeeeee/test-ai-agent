import { useState } from "react";

type Props = {
  bridge: { loadSettings: () => Promise<unknown>; saveSettings: (s: unknown) => unknown };
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
};

const NAV_ITEMS = [
  { key: "connection", icon: "🔗", label: "连接" },
  { key: "conversation", icon: "💬", label: "对话" },
  { key: "appearance", icon: "🎨", label: "外观" },
  { key: "security", icon: "🛡", label: "安全" },
  { key: "output", icon: "📋", label: "输出" },
  { key: "debug", icon: "🔧", label: "调试" },
] as const;

export function SettingsModal({ onClose, theme, onThemeChange }: Props) {
  const [activeNav, setActiveNav] = useState("connection");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  return (
    <div className="settings-modal-overlay" role="presentation">
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
          </div>
        </div>
      </div>
    </div>
  );
}
