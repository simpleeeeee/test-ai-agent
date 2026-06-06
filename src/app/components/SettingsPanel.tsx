import { useEffect, useState } from "react";

type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type SettingsBridge = {
  loadSettings: () => Promise<SettingsFormValues>;
  saveSettings: (settings: SettingsFormValues) => unknown;
};

type Props = {
  bridge: SettingsBridge;
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
};

export function SettingsPanel({ bridge, onClose, onThemeChange, theme }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    bridge.loadSettings().then((s) => {
      setBaseUrl(s.baseUrl || "");
      setApiKey(s.apiKey || "");
      setModel(s.model || "");
    });
  }, [bridge]);

  function handleSave() {
    bridge.saveSettings({ baseUrl, apiKey, model });
  }

  return (
    <div className="settings-overlay open" onClick={onClose} role="presentation">
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="setting-row">
          <div className="setting-label">Base URL</div>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} onBlur={handleSave} placeholder="https://api.anthropic.com" />
        </div>
        <div className="setting-row">
          <div className="setting-label">API Key</div>
          <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={handleSave} placeholder="sk-ant-api-..." />
        </div>
        <div className="setting-row">
          <div className="setting-label">模型</div>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)} onBlur={handleSave} placeholder="claude-sonnet-4-6" />
        </div>
        <div className="setting-divider" />
        <div className="setting-row-inline">
          <div className="setting-label">主题</div>
          <div className="theme-switch">
            <button className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")}>浅色</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")}>暗色</button>
          </div>
        </div>
      </div>
    </div>
  );
}
