import { useEffect, useState } from "react";

// 需与 electron/agent/sdkSettings.ts 中的 SettingsFormValues 保持一致
type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type SettingsBridge = {
  loadSettings: () => Promise<SettingsFormValues>;
  saveSettings: (settings: SettingsFormValues) => unknown;
};

const emptySettings: SettingsFormValues = {
  baseUrl: "",
  apiKey: "",
  model: "",
};

type Props = {
  bridge: SettingsBridge;
  onModelSaved?: (model: string) => void;
};

export function SdkControlDrawer({ bridge, onModelSaved }: Props) {
  const [settings, setSettings] = useState<SettingsFormValues>(emptySettings);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    void bridge.loadSettings().then((loaded) => {
      if (active) {
        setSettings(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, [bridge]);

  function updateField(key: keyof SettingsFormValues, value: string) {
    setStatus("");
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings() {
    setStatus("");
    await bridge.saveSettings(settings);
    setStatus("设置已保存");
    onModelSaved?.(settings.model);
  }

  return (
    <aside className="sdk-control-drawer" aria-label="SDK 控制">
      <header className="sdk-control-header">
        <div>
          <h2>SDK 控制</h2>
          <p>保存到 .claude/settings.json 或 .claude/settings.local.json，使用 Claude Agent SDK 原生配置结构。</p>
        </div>
      </header>
      <section className="sdk-control-section" aria-label="Claude Agent SDK 设置">
        <label>
          Base URL
          <input
            value={settings.baseUrl}
            onChange={(event) => updateField("baseUrl", event.currentTarget.value)}
          />
        </label>
        <label>
          API Key
          <input
            type="text"
            value={settings.apiKey}
            onChange={(event) => updateField("apiKey", event.currentTarget.value)}
          />
        </label>
        <label>
          模型名称
          <input
            value={settings.model}
            onChange={(event) => updateField("model", event.currentTarget.value)}
          />
        </label>
        <button type="button" onClick={saveSettings}>保存设置</button>
        {status ? <span className="sdk-save-status" role="status">{status}</span> : null}
      </section>
    </aside>
  );
}
