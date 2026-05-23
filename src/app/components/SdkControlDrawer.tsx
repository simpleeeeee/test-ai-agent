import { useState } from "react";

type ControlBridge = {
  setModel: (runId: string, model: string) => unknown;
  setPermissionMode: (runId: string, mode: string) => unknown;
  applySettings: (runId: string, settings: Record<string, unknown>) => unknown;
  supportedModels: (runId: string) => unknown;
  supportedCommands: (runId: string) => unknown;
  supportedAgents: (runId: string) => unknown;
  accountInfo: (runId: string) => unknown;
  initializationResult: (runId: string) => unknown;
  stopTask: (runId: string, taskId: string) => unknown;
};

export function SdkControlDrawer({ runId, activeTaskId, bridge }: { runId: string; activeTaskId?: string; bridge: ControlBridge }) {
  const [model, setModelValue] = useState("");
  const [permissionMode, setPermissionModeValue] = useState("default");
  const [settings, setSettings] = useState("{}");

  return (
    <aside className="sdk-control-drawer" aria-label="SDK 控制">
      <label>模型<input value={model} onChange={(event) => setModelValue(event.currentTarget.value)} /></label>
      <button type="button" onClick={() => bridge.setModel(runId, model)}>应用模型</button>
      <label>
        权限模式
        <select value={permissionMode} onChange={(event) => setPermissionModeValue(event.currentTarget.value)}>
          {["default", "acceptEdits", "bypassPermissions", "plan", "dontAsk", "auto"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => bridge.setPermissionMode(runId, permissionMode)}>应用权限</button>
      <label>Flag Settings JSON<textarea value={settings} onChange={(event) => setSettings(event.currentTarget.value)} /></label>
      <button type="button" onClick={() => bridge.applySettings(runId, JSON.parse(settings) as Record<string, unknown>)}>应用设置</button>
      <div className="button-grid">
        <button type="button" onClick={() => bridge.supportedModels(runId)}>支持模型</button>
        <button type="button" onClick={() => bridge.supportedCommands(runId)}>支持命令</button>
        <button type="button" onClick={() => bridge.supportedAgents(runId)}>支持 Agents</button>
        <button type="button" onClick={() => bridge.accountInfo(runId)}>账号信息</button>
        <button type="button" onClick={() => bridge.initializationResult(runId)}>初始化结果</button>
        <button type="button" disabled={!activeTaskId} onClick={() => activeTaskId && bridge.stopTask(runId, activeTaskId)}>停止任务</button>
      </div>
    </aside>
  );
}
