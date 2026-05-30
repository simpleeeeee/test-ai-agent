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
  activeRunId?: string;
  onApplySettings?: (runId: string, settings: Record<string, unknown>) => void;
};

export function SettingsPanel({ bridge, onClose, onThemeChange, theme, activeRunId, onApplySettings }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [permissionMode, setPermissionMode] = useState("default");
  const [thinkingEffort, setThinkingEffort] = useState("medium");
  const [thinkingDisplay, setThinkingDisplay] = useState("summarized");

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

  function handleApplySdkSettings() {
    if (activeRunId && onApplySettings) {
      onApplySettings(activeRunId, {
        permissionMode,
        thinking: { effort: thinkingEffort, display: thinkingDisplay },
      });
    }
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
        <div className="setting-row">
          <label className="setting-label" htmlFor="sdk-permission-mode">权限模式</label>
          <select id="sdk-permission-mode" aria-label="权限模式" value={permissionMode} onChange={(e) => setPermissionMode(e.target.value)}>
            <option value="default">default</option>
            <option value="acceptEdits">acceptEdits</option>
            <option value="bypassPermissions">bypassPermissions</option>
            <option value="plan">plan</option>
          </select>
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="sdk-thinking-effort">思考强度</label>
          <select id="sdk-thinking-effort" aria-label="思考强度" value={thinkingEffort} onChange={(e) => setThinkingEffort(e.target.value)}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="xhigh">xhigh</option>
            <option value="max">max</option>
          </select>
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="sdk-thinking-display">Thinking 展示</label>
          <select id="sdk-thinking-display" aria-label="Thinking 展示" value={thinkingDisplay} onChange={(e) => setThinkingDisplay(e.target.value)}>
            <option value="summarized">summarized</option>
            <option value="omitted">omitted</option>
          </select>
        </div>
        <div className="setting-row">
          <button type="button" onClick={handleApplySdkSettings}>应用设置</button>
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
