import { useEffect, useState } from "react";
import { OUTPUT_SCHEMA_TEMPLATES } from "../../domain/outputSchemas.js";
import type { ConnectionStatus } from "../../ipc/connectionTypes.js";

type Props = {
  bridge: { loadSettings: () => Promise<Record<string, unknown>>; saveSettings: (settings: Record<string, unknown>) => unknown; probeConnection?: (baseUrl: string, model: string) => Promise<ConnectionStatus> };
  onClose: () => void;
  onThemeChange: (mode: "light" | "dark") => void;
  theme: "light" | "dark";
  activeRunId?: string;
  onApplySettings?: (runId: string, settings: Record<string, unknown>) => void;
  connectionStatus?: ConnectionStatus;
};

const NAV_ITEMS = [
  { key: "connection", icon: "🔗", label: "连接" },
  { key: "conversation", icon: "💬", label: "对话" },
  { key: "appearance", icon: "🎨", label: "外观" },
  { key: "security", icon: "🛡", label: "安全" },
  { key: "output", icon: "📋", label: "输出" },
  { key: "debug", icon: "🔧", label: "调试" },
] as const;

export function SettingsModal({ bridge, onClose, theme, onThemeChange, activeRunId, onApplySettings, connectionStatus }: Props) {
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
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [promptCaching, setPromptCaching] = useState(false);
  const [outputFormatEnabled, setOutputFormatEnabled] = useState(false);
  const [outputFormatTemplate, setOutputFormatTemplate] = useState("test_plan");
  const [customSchema, setCustomSchema] = useState("");
  const [debug, setDebug] = useState(false);
  const [debugFile, setDebugFile] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    bridge.loadSettings().then((raw) => {
      if (cancelled) return;
      const s = raw as Record<string, unknown>;
      setBaseUrl((s.baseUrl as string) || "");
      setApiKey((s.apiKey as string) || "");
      setModel((s.model as string) || "");
      setEffort((s.effort as string) || "high");
      setSandboxEnabled((s.sandboxEnabled as boolean) ?? false);
      setPromptCaching((s.promptCaching as boolean) ?? false);
      setDebug((s.debug as boolean) ?? false);
      setDebugFile((s.debugFile as string) ?? "");
      setMaxTurns((s.maxTurns as number) || 50);
      setMaxBudgetUsd((s.maxBudgetUsd as number) || 5);
      setPermissionMode((s.permissionMode as string) || "default");
      setThinkingEffort((s.thinkingEffort as string) || "medium");
      setThinkingDisplay((s.thinkingDisplay as string) || "summarized");
      if (s.outputFormat) {
        setOutputFormatEnabled(true);
        setOutputFormatTemplate((s.outputFormat as Record<string, string>).template || "test_plan");
        setCustomSchema((s.outputFormat as Record<string, string>).customSchema || "");
      }
    });
    return () => { cancelled = true; };
  }, [bridge]);

  function handleSave(overrides?: Record<string, unknown>) {
    const outputFormatValue = outputFormatEnabled
      ? { template: outputFormatTemplate, customSchema: outputFormatTemplate === "custom" ? customSchema : null }
      : undefined;
    bridge.saveSettings({
      baseUrl, apiKey, model, effort, sandboxEnabled, promptCaching,
      debug, debugFile, maxBudgetUsd, maxTurns,
      outputFormat: outputFormatValue,
      permissionMode,
      thinkingEffort,
      thinkingDisplay,
      ...overrides,
    });
  }

  function handleApplySdkSettings() {
    if (activeRunId && onApplySettings) {
      onApplySettings(activeRunId, {
        permissionMode,
        thinking: { effort: thinkingEffort, display: thinkingDisplay },
      });
    }
  }

  const effectiveStatus = probeResult ?? connectionStatus;

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
                  <input className="settings-input" type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} onBlur={() => handleSave()} placeholder="https://api.anthropic.com" />
                </div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">API Key</span>
                    <span className="settings-field-hint">用于身份验证的 API 密钥</span>
                  </div>
                  <input className="settings-input" type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={() => handleSave()} placeholder="sk-ant-api-..." />
                </div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">模型</span>
                    <span className="settings-field-hint">默认使用的 Claude 模型</span>
                  </div>
                  <input className="settings-input" type="text" value={model} onChange={(e) => setModel(e.target.value)} onBlur={() => handleSave()} placeholder="claude-sonnet-4-6" />
                </div>
              </div>
            )}
            {activeNav === "connection" && (
              <div className="settings-section">
                <div className="settings-section-title">连接状态</div>
                <div className="settings-field">
                  {effectiveStatus && (
                    <div
                      className={`settings-conn-status${effectiveStatus.state === "connected" ? " connected" : ""}`}
                      onClick={() => effectiveStatus.state === "failed" && setShowConnectionError(!showConnectionError)}
                      role={effectiveStatus.state === "failed" ? "button" : undefined}
                      aria-expanded={effectiveStatus.state === "failed" ? showConnectionError : undefined}
                      style={effectiveStatus.state === "failed" ? { cursor: "pointer" } : undefined}
                    >
                      <span className="conn-dot" />
                      <span>
                        {effectiveStatus.state === "connected" ? "已连接" :
                         effectiveStatus.state === "unverified" ? "未验证" :
                         effectiveStatus.state === "connecting" ? "验证中..." :
                         effectiveStatus.state === "failed" ? "连接失败" : "未验证"}
                      </span>
                      {effectiveStatus.state === "connected" && <> 至 {effectiveStatus.model}</>}
                    </div>
                  )}
                  <button
                    className="settings-btn"
                    disabled={probing}
                    onClick={async () => {
                      setProbing(true);
                      setShowConnectionError(false);
                      setProbeResult({ state: "connecting", baseUrl, model, probedAt: Date.now() });
                      try {
                        if (!bridge.probeConnection) {
                          throw new Error("probeConnection not available");
                        }
                        const result = await bridge.probeConnection(baseUrl, model);
                        setProbeResult(result);
                      } catch {
                        setProbeResult({
                          state: "failed",
                          baseUrl,
                          model,
                          error: { code: "UNKNOWN", message: "连接测试失败", suggestion: "请检查网络连接后重试" },
                          probedAt: Date.now(),
                        });
                      } finally {
                        setProbing(false);
                      }
                    }}
                  >
                    {probing ? "验证中..." : "测试连接"}
                  </button>
                </div>
                {showConnectionError && effectiveStatus?.error && (
                  <div className="settings-conn-error" role="region" aria-label="连接错误详情">
                    <p>{effectiveStatus.error.message}</p>
                    <p className="conn-error-suggestion">{effectiveStatus.error.suggestion}</p>
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
                      onClick={() => { onThemeChange("light"); handleSave({ theme: "light" }); }}
                    >浅色</button>
                    <button
                      className={`settings-toggle-btn${theme === "dark" ? " active" : ""}`}
                      onClick={() => { onThemeChange("dark"); handleSave({ theme: "dark" }); }}
                    >暗色</button>
                  </div>
                </div>
              </div>
            )}
            {activeNav === "security" && (
              <div className="settings-section">
                <div className="settings-section-title">安全与优化</div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">沙箱保护</span>
                    <span className="settings-field-hint">隔离文件系统和网络访问</span>
                  </div>
                  <div className="settings-toggle">
                    <button className={`settings-toggle-btn${sandboxEnabled ? " active" : ""}`}
                      onClick={() => { setSandboxEnabled(true); handleSave({ sandboxEnabled: true }); }}>开</button>
                    <button className={`settings-toggle-btn${!sandboxEnabled ? " active" : ""}`}
                      onClick={() => { setSandboxEnabled(false); handleSave({ sandboxEnabled: false }); }}>关</button>
                  </div>
                </div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">Prompt 缓存</span>
                    <span className="settings-field-hint">重复上下文可降低 token 消耗</span>
                  </div>
                  <div className="settings-toggle">
                    <button className={`settings-toggle-btn${promptCaching ? " active" : ""}`}
                      onClick={() => { setPromptCaching(true); handleSave({ promptCaching: true }); }}>开</button>
                    <button className={`settings-toggle-btn${!promptCaching ? " active" : ""}`}
                      onClick={() => { setPromptCaching(false); handleSave({ promptCaching: false }); }}>关</button>
                  </div>
                </div>
              </div>
            )}
            {activeNav === "output" && (
              <div className="settings-section">
                <div className="settings-section-title">结构化输出</div>
                <div className="settings-field">
                  <div className="settings-field-label-group">
                    <span className="settings-field-label">启用结构化输出</span>
                    <span className="settings-field-hint">让 AI 按指定 JSON Schema 格式输出</span>
                  </div>
                  <div className="settings-toggle">
                    <button className={`settings-toggle-btn${outputFormatEnabled ? " active" : ""}`}
                      onClick={() => { setOutputFormatEnabled(true); handleSave({ outputFormat: { template: outputFormatTemplate, customSchema: outputFormatTemplate === "custom" ? customSchema : null } }); }}>开</button>
                    <button className={`settings-toggle-btn${!outputFormatEnabled ? " active" : ""}`}
                      onClick={() => { setOutputFormatEnabled(false); handleSave({ outputFormat: undefined }); }}>关</button>
                  </div>
                </div>
                {outputFormatEnabled && (
                  <>
                    <div className="settings-field">
                      <div className="settings-field-label-group">
                        <label className="settings-field-label" htmlFor="output-template">输出模板</label>
                        <span className="settings-field-hint">选择预设的输出格式模板</span>
                      </div>
                      <select id="output-template" className="settings-select" value={outputFormatTemplate}
                        onChange={(e) => { setOutputFormatTemplate(e.target.value); handleSave({ outputFormat: { template: e.target.value, customSchema: e.target.value === "custom" ? customSchema : null } }); }}>
                        {OUTPUT_SCHEMA_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    {outputFormatTemplate === "custom" && (
                      <div className="settings-field-block">
                        <div className="settings-field-label-group">
                          <label className="settings-field-label" htmlFor="custom-schema">自定义 Schema</label>
                          <span className="settings-field-hint">JSON Schema 定义，当模板选择「自定义」时生效</span>
                        </div>
                        <textarea id="custom-schema" className="settings-textarea"
                          value={customSchema} onChange={(e) => setCustomSchema(e.target.value)}
                          onBlur={() => handleSave()}
                          placeholder='{ "type": "object", "properties": {...} }' />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {activeNav === "debug" && (
              <>
                <div className="settings-section">
                  <div className="settings-section-title">开发调试</div>
                  <div className="settings-field">
                    <div className="settings-field-label-group">
                      <span className="settings-field-label">调试模式</span>
                      <span className="settings-field-hint">记录 SDK 原始消息用于排查问题</span>
                    </div>
                    <div className="settings-toggle">
                      <button className={`settings-toggle-btn${debug ? " active" : ""}`}
                        onClick={() => { setDebug(true); handleSave({ debug: true }); }}>开</button>
                      <button className={`settings-toggle-btn${!debug ? " active" : ""}`}
                        onClick={() => { setDebug(false); handleSave({ debug: false }); }}>关</button>
                    </div>
                  </div>
                  {debug && (
                    <div className="settings-field">
                      <div className="settings-field-label-group">
                        <label className="settings-field-label" htmlFor="debug-file">日志文件路径</label>
                        <span className="settings-field-hint">调试日志的保存位置</span>
                      </div>
                      <input id="debug-file" className="settings-input" type="text" value={debugFile}
                        onChange={(e) => setDebugFile(e.target.value)} onBlur={() => handleSave()} placeholder=".claude/debug.log" />
                    </div>
                  )}
                </div>
                <div className="settings-section">
                  <div className="settings-section-title">日志操作</div>
                  <div className="settings-actions">
                    <button className="settings-btn" type="button" disabled title="日志功能即将开放">导出调试日志</button>
                    <button className="settings-btn" type="button" disabled title="日志功能即将开放">复制最近日志</button>
                  </div>
                </div>
              </>
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
                      value={permissionMode} onChange={(e) => { setPermissionMode(e.target.value); handleSave({ permissionMode: e.target.value }); }}>
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
                      value={thinkingEffort} onChange={(e) => { setThinkingEffort(e.target.value); handleSave({ thinkingEffort: e.target.value }); }}>
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
                      value={thinkingDisplay} onChange={(e) => { setThinkingDisplay(e.target.value); handleSave({ thinkingDisplay: e.target.value }); }}>
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
                      value={maxTurns} onChange={(e) => { const v = Number(e.target.value); setMaxTurns(v); handleSave({ maxTurns: v }); }} />
                  </div>
                  <div className="settings-field">
                    <div className="settings-field-label-group">
                      <label className="settings-field-label" htmlFor="max-budget">成本上限 (USD)</label>
                      <span className="settings-field-hint">单次会话的费用上限</span>
                    </div>
                    <input id="max-budget" className="settings-input-number" type="number" min={0.01} step={0.01}
                      value={maxBudgetUsd} onChange={(e) => { const v = Number(e.target.value); setMaxBudgetUsd(v); handleSave({ maxBudgetUsd: v }); }} />
                  </div>
                </div>
                <div className="settings-actions">
                  <button className="settings-btn primary" type="button" onClick={handleApplySdkSettings}>应用设置</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
