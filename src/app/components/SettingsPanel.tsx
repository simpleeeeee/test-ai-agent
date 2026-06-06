import { useEffect, useState } from "react";

type SettingsBridge = {
  loadSettings: () => Promise<Record<string, unknown>>;
  saveSettings: (settings: Record<string, unknown>) => unknown;
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
    bridge.loadSettings().then((raw) => {
      const s = raw as Record<string, unknown>;
      setBaseUrl((s.baseUrl as string) || "");
      setApiKey((s.apiKey as string) || "");
      setModel((s.model as string) || "");
    });
  }, [bridge]);

  function handleSave() {
    bridge.saveSettings({ baseUrl, apiKey, model });
  }

  return (
    <div className="settings-overlay open" onClick={onClose} role="presentation">
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="setting-row">
          <label className="setting-label" htmlFor="settings-base-url">Base URL</label>
          <input id="settings-base-url" type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} onBlur={handleSave} placeholder="https://api.anthropic.com" />
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="settings-api-key">API Key</label>
          <input id="settings-api-key" type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={handleSave} placeholder="sk-ant-api-..." />
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="settings-model">模型</label>
          <input id="settings-model" type="text" value={model} onChange={(e) => setModel(e.target.value)} onBlur={handleSave} placeholder="claude-sonnet-4-6" />
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
