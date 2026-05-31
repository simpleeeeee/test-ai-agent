import { query as realQuery } from "./claudeAgentSdkFacade.js";

type QueryFunction = typeof realQuery;

export type StartRuntimeInput = {
  prompt: string | AsyncIterable<unknown>;
  options: Record<string, unknown>;
  canUseTool: (...args: any[]) => Promise<unknown>;
};

export class ClaudeAgentRuntimeAdapter {
  constructor(private readonly sdk: { query: QueryFunction } = { query: realQuery }) {}

  start(input: StartRuntimeInput) {
    // The SDK's Query type uses complex generics that don't map cleanly to a
    // dependency-injectable adapter. We cast through `any` here to avoid leaking
    // SDK generics into all callers — the facade test verifies the runtime surface
    // contract instead.
    const queryResult = this.sdk.query({
      prompt: input.prompt as any,
      options: {
        ...input.options,
        canUseTool: input.canUseTool,
      } as any,
    }) as any;

    return {
      messages: queryResult as AsyncIterable<unknown>,
      close: () => queryResult.close(),
      setModel: (model: string) => queryResult.setModel(model),
      setPermissionMode: (mode: string) => queryResult.setPermissionMode(mode),
      applyFlagSettings: (settings: Record<string, unknown>) => queryResult.applyFlagSettings(settings),
      mcpServerStatus: () => queryResult.mcpServerStatus(),
      setMcpServers: (servers: Record<string, unknown>) => queryResult.setMcpServers(servers),
      reconnectMcpServer: (serverName: string) => queryResult.reconnectMcpServer(serverName),
      toggleMcpServer: (serverName: string, enabled: boolean) => queryResult.toggleMcpServer(serverName, enabled),
      supportedCommands: () => queryResult.supportedCommands(),
      supportedModels: () => queryResult.supportedModels(),
      supportedAgents: () => queryResult.supportedAgents(),
      accountInfo: () => queryResult.accountInfo(),
      initializationResult: () => queryResult.initializationResult(),
      streamInput: (message: unknown) => {
        async function* once() {
          yield message;
        }
        return queryResult.streamInput(once() as any);
      },
      stopTask: (taskId: string) => queryResult.stopTask(taskId),
      // === Plan 2 新增 ===
      getContextUsage: () => (queryResult as any).getContextUsage(),
      interrupt: () => (queryResult as any).interrupt(),
      backgroundTasks: (toolUseId?: string) => (queryResult as any).backgroundTasks(toolUseId),
      readFile: (path: string, options?: { maxBytes?: number; encoding?: "utf-8" | "base64" }) =>
        (queryResult as any).readFile(path, options),
      reloadPlugins: () => (queryResult as any).reloadPlugins(),
      rewindFiles: (userMessageId: string, options?: { dryRun?: boolean }) =>
        (queryResult as any).rewindFiles(userMessageId, options),
      seedReadState: (path: string, mtime: number) =>
        (queryResult as any).seedReadState(path, mtime),
    };
  }
}
