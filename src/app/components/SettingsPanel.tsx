import { useEffect, useState } from "react";
import type { ModelCapabilities } from "../sdkUiTypes";
import { OUTPUT_SCHEMA_TEMPLATES } from "../../domain/outputSchemas.js";

type SettingsFormValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
  effort?: string;
  sandboxEnabled?: boolean;
  promptCaching?: boolean;
  debug?: boolean;
  debugFile?: string;
  maxBudgetUsd?: number;
  maxTurns?: number;
  outputFormat?: { template?: string; customSchema?: string | null };
};

type SettingsBridge = {
  loadSettings: () => Promise<SettingsFormValues>;
  saveSettings: (settings: SettingsFormValues) => unknown;
};

type ConnectionStatus = {
  state: string;
  baseUrl: string;
  model: string;
  error?: { code: string; message: string; suggestion: string };
  probedAt: number;
};

type Props = {
  bridge: SettingsBridge;
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
  activeRunId?: string;
  onApplySettings?: (runId: string, settings: Record<string, unknown>) => void;
  connectionStatus?: ConnectionStatus;
  modelCapabilities?: ModelCapabilities;
};

export function SettingsPanel({ bridge, onClose, onThemeChange, theme, activeRunId, onApplySettings, connectionStatus, modelCapabilities }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [permissionMode, setPermissionMode] = useState("default");
  const [thinkingEffort, setThinkingEffort] = useState("medium");
  const [thinkingDisplay, setThinkingDisplay] = useState("summarized");
  const [effort, setEffort] = useState("high");
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [promptCaching, setPromptCaching] = useState(false);
  const [outputFormatEnabled, setOutputFormatEnabled] = useState(false);
  const [outputFormatTemplate, setOutputFormatTemplate] = useState("test_plan");
  const [customSchema, setCustomSchema] = useState("");
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [debug, setDebug] = useState(false);
  const [debugFile, setDebugFile] = useState("");
  const [maxTurns, setMaxTurns] = useState(50);
  const [maxBudgetUsd, setMaxBudgetUsd] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    bridge.loadSettings().then((s) => {
      setBaseUrl(s.baseUrl || "");
      setApiKey(s.apiKey || "");
      setModel(s.model || "");
      setEffort(s.effort || "high");
      setSandboxEnabled(s.sandboxEnabled ?? false);
      setPromptCaching(s.promptCaching ?? false);
      setDebug(s.debug ?? false);
      setDebugFile(s.debugFile ?? "");
      setMaxTurns(s.maxTurns || 50);
      setMaxBudgetUsd(s.maxBudgetUsd || 5);
      if (s.outputFormat) {
        setOutputFormatEnabled(true);
        setOutputFormatTemplate(s.outputFormat.template || "test_plan");
        setCustomSchema(s.outputFormat.customSchema || "");
      }
    });
  }, [bridge]);

  function handleSave(overrides?: Partial<SettingsFormValues>) {
    const outputFormatValue = outputFormatEnabled
      ? { template: outputFormatTemplate, customSchema: outputFormatTemplate === "custom" ? customSchema : null }
      : undefined;
    bridge.saveSettings({ baseUrl, apiKey, model, effort, sandboxEnabled, promptCaching, debug, debugFile, maxBudgetUsd, maxTurns, outputFormat: outputFormatValue, ...overrides });
  }

  function handleApplySdkSettings() {
    if (activeRunId && onApplySettings) {
      onApplySettings(activeRunId, {
        permissionMode,
        thinking: { effort: thinkingEffort, display: thinkingDisplay },
      });
    }
  }

  function getStatusClass(state: string): string {
    switch (state) {
      case "connected": return "done";
      case "unverified": return "idle";
      case "connecting": return "active";
      case "failed": return "error";
      default: return "idle";
    }
  }

  function getStatusLabel(state: string): string {
    switch (state) {
      case "connected": return "已连接";
      case "unverified": return "未验证";
      case "connecting": return "验证中...";
      case "failed": return "连接失败";
      default: return "未验证";
    }
  }

  function handleTestConnection() {
    const b = bridge as SettingsBridge & { testConnection?: () => void };
    b.testConnection?.();
  }

  function handleExportLogs() {
    const b = bridge as SettingsBridge & { exportLogs?: () => void };
    b.exportLogs?.();
  }

  function handleCopyRecentLogs() {
    const b = bridge as SettingsBridge & { copyRecentLogs?: () => void };
    b.copyRecentLogs?.();
  }

  return (
    <div className="settings-overlay open" onClick={onClose} role="presentation">
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        {connectionStatus && (
          <div className="connection-status-row">
            <div
              className={`connection-indicator ${connectionStatus.state}`}
              onClick={() => connectionStatus.state === "failed" && setShowConnectionError(!showConnectionError)}
              role="button"
              aria-expanded={showConnectionError}
            >
              <span className={`activity-indicator ${getStatusClass(connectionStatus.state)}`} />
              <span className="connection-label">{getStatusLabel(connectionStatus.state)}</span>
            </div>
            <button className="test-connection-btn" onClick={handleTestConnection}>测试连接</button>
            {showConnectionError && connectionStatus.error && (
              <div className="connection-error-detail" role="region" aria-label="连接错误详情">
                <p>{connectionStatus.error.message}</p>
                <p className="connection-error-suggestion">{connectionStatus.error.suggestion}</p>
              </div>
            )}
          </div>
        )}
        <div className="setting-row">
          <div className="setting-label">Base URL</div>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} onBlur={() => handleSave()} placeholder="https://api.anthropic.com" />
        </div>
        <div className="setting-row">
          <div className="setting-label">API Key</div>
          <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={() => handleSave()} placeholder="sk-ant-api-..." />
        </div>
        <div className="setting-row">
          <div className="setting-label">模型</div>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)} onBlur={() => handleSave()} placeholder="claude-sonnet-4-6" />
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
          <select id="sdk-thinking-effort" aria-label="思考强度"
            value={thinkingEffort} onChange={(e) => setThinkingEffort(e.target.value)}
            disabled={modelCapabilities != null && !modelCapabilities.supportsThinking}
            title={modelCapabilities != null && !modelCapabilities.supportsThinking ? "当前模型不支持扩展思考" : undefined}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="xhigh">xhigh</option>
            <option value="max">max</option>
          </select>
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="sdk-thinking-display">Thinking 展示</label>
          <select id="sdk-thinking-display" aria-label="Thinking 展示"
            value={thinkingDisplay} onChange={(e) => setThinkingDisplay(e.target.value)}
            disabled={modelCapabilities != null && !modelCapabilities.supportsThinking}
            title={modelCapabilities != null && !modelCapabilities.supportsThinking ? "当前模型不支持扩展思考" : undefined}>
            <option value="summarized">summarized</option>
            <option value="omitted">omitted</option>
          </select>
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="sdk-effort">推理努力程度</label>
          <select id="sdk-effort" aria-label="推理努力程度"
            value={effort} onChange={(e) => { setEffort(e.target.value); handleSave({ effort: e.target.value }); }}
            disabled={modelCapabilities != null && !modelCapabilities.supportsThinking}
            title={modelCapabilities != null && !modelCapabilities.supportsThinking ? "当前模型不支持扩展思考" : undefined}>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="xhigh">极高</option>
            <option value="max">最大</option>
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
        <div className="setting-divider" />
        <div className="setting-row-inline">
          <span className="setting-label">沙箱保护</span>
          <div className="sandbox-switch">
            <button className={sandboxEnabled ? "active" : ""}
              onClick={() => { setSandboxEnabled(true); handleSave({ sandboxEnabled: true }); }}>
              开
            </button>
            <button className={!sandboxEnabled ? "active" : ""}
              onClick={() => { setSandboxEnabled(false); handleSave({ sandboxEnabled: false }); }}>
              关
            </button>
          </div>
        </div>
        <div className="setting-divider" />
        <div className="advanced-settings-section">
          <button
            type="button"
            className="advanced-settings-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
          >
            <span className="toggle-arrow">{showAdvanced ? "▼" : "▶"}</span>
            <span className="setting-label">高级设置</span>
          </button>
          {showAdvanced && (
            <div className="advanced-settings-content">
              <div className="setting-row">
                <div className="setting-label">
                  <span>Prompt 缓存</span>
                  <span className="setting-subtitle">重复上下文可降低 token 消耗</span>
                </div>
                <div className="switch-group">
                  <button className={promptCaching ? "active" : ""} onClick={() => { setPromptCaching(true); handleSave({ promptCaching: true }); }}
                          disabled={!modelCapabilities?.supportsPromptCaching}
                          title={!modelCapabilities?.supportsPromptCaching ? "当前模型不支持 Prompt Caching" : undefined}>开</button>
                  <button className={!promptCaching ? "active" : ""} onClick={() => { setPromptCaching(false); handleSave({ promptCaching: false }); }}>关</button>
                </div>
              </div>
              <div className="setting-divider" />
              <div className="setting-row">
                <div className="setting-label">
                  <span>结构化输出</span>
                  <span className="setting-subtitle">让 AI 按指定 JSON 格式输出</span>
                </div>
                <div className="switch-group">
                  <button className={outputFormatEnabled ? "active" : ""} onClick={() => setOutputFormatEnabled(true)}
                          disabled={!modelCapabilities?.supportsJsonSchema}
                          title={!modelCapabilities?.supportsJsonSchema ? "当前模型不支持 JSON Schema 输出" : undefined}>开</button>
                  <button className={!outputFormatEnabled ? "active" : ""} onClick={() => setOutputFormatEnabled(false)}>关</button>
                </div>
              </div>
              {outputFormatEnabled && (
                <>
                  <div className="setting-row">
                    <label className="setting-label" htmlFor="output-template">输出模板</label>
                    <select id="output-template" value={outputFormatTemplate} onChange={(e) => setOutputFormatTemplate(e.target.value)}>
                      {OUTPUT_SCHEMA_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  {outputFormatTemplate === "custom" && (
                    <div className="setting-row">
                      <label className="setting-label" htmlFor="custom-schema">自定义 Schema</label>
                      <textarea id="custom-schema" value={customSchema} onChange={(e) => setCustomSchema(e.target.value)}
                                placeholder='{ "type": "object", "properties": {...} }'
                                style={{ fontFamily: "var(--font-mono)", minHeight: 120 }} />
                    </div>
                  )}
                </>
              )}
              <div className="setting-divider" />
              <div className="setting-row">
                <label className="setting-label" htmlFor="max-turns">最大对话轮数</label>
                <input id="max-turns" type="number" min={1} max={100} value={maxTurns}
                       onChange={(e) => { const v = Number(e.target.value); setMaxTurns(v); handleSave({ maxTurns: v }); }} />
              </div>
              <div className="setting-divider" />
              <div className="setting-row">
                <label className="setting-label" htmlFor="max-budget">成本上限 (USD)</label>
                <input id="max-budget" type="number" min={0.01} step={0.01} value={maxBudgetUsd}
                       onChange={(e) => { const v = Number(e.target.value); setMaxBudgetUsd(v); handleSave({ maxBudgetUsd: v }); }} />
              </div>
              <div className="setting-divider" />
              <div className="setting-row">
                <div className="setting-label">
                  <span>调试模式</span>
                  <span className="setting-subtitle">记录 SDK 原始消息用于排查问题</span>
                </div>
                <div className="switch-group">
                  <button className={debug ? "active" : ""} onClick={() => { setDebug(true); handleSave({ debug: true }); }}>开</button>
                  <button className={!debug ? "active" : ""} onClick={() => { setDebug(false); handleSave({ debug: false }); }}>关</button>
                </div>
              </div>
              {debug && (
                <div className="setting-row">
                  <label className="setting-label" htmlFor="debug-file">日志文件路径</label>
                  <input id="debug-file" type="text" value={debugFile} onChange={(e) => setDebugFile(e.target.value)} onBlur={() => handleSave()} placeholder=".claude/debug.log" />
                </div>
              )}
              <div className="setting-footer-actions">
                <button className="setting-action-btn" onClick={handleExportLogs}>导出调试日志</button>
                <button className="setting-action-btn" onClick={handleCopyRecentLogs}>复制最近日志</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
