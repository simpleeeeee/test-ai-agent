import type { McpServerUiStatus } from "../sdkUiTypes";

type McpBridge = {
  mcpStatus: (runId: string) => unknown;
  reconnectMcpServer: (runId: string, serverName: string) => unknown;
  toggleMcpServer: (runId: string, serverName: string, enabled: boolean) => unknown;
};

export function McpStatusPanel({ runId, servers, bridge }: { runId: string; servers: McpServerUiStatus[]; bridge: McpBridge }) {
  return (
    <aside className="mcp-status-panel" aria-label="MCP 服务状态">
      <button type="button" onClick={() => bridge.mcpStatus(runId)}>刷新 MCP</button>
      {servers.map((server) => (
        <div className="mcp-row" key={server.name}>
          <span>{server.name}</span>
          <span>{server.status}</span>
          <button type="button" onClick={() => bridge.reconnectMcpServer(runId, server.name)}>重连</button>
          <button type="button" onClick={() => bridge.toggleMcpServer(runId, server.name, server.status === "disabled")}>切换</button>
        </div>
      ))}
    </aside>
  );
}
