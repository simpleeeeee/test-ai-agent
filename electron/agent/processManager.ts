import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";

// ── 类型定义 ────────────────────────────────────────────────

export type ProcessStatus = "starting" | "running" | "stopping" | "stopped" | "crashed";

export type ProcessState = {
  pid: number | null;
  status: ProcessStatus;
  startedAt: number;
  restartCount: number;
  lastError?: string;
};

export type ProcessManagerOptions = {
  maxRestarts: number;
  restartBackoffMs: number;
  onStateChange: (state: ProcessState) => void;
};

type SpawnOpts = {
  command: string;
  args?: string[];
  /** 内部测试钩子：允许注入 mock spawn 函数来替代真正的 child_process.spawn */
  options?: Record<string, unknown> & { _mockSpawn?: (...args: any[]) => ChildProcess };
};

// ── 工厂函数 ────────────────────────────────────────────────

export function createProcessManager(options: ProcessManagerOptions) {
  const { maxRestarts, restartBackoffMs, onStateChange } = options;

  let state: ProcessState = {
    pid: null,
    status: "stopped",
    startedAt: 0,
    restartCount: 0,
  };

  let child: ChildProcess | null = null;
  let lastSpawnOpts: SpawnOpts | null = null;
  let shutdownResolve: (() => void) | null = null;
  let shuttingDown = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  // ── 内部工具函数 ──────────────────────────────────────────

  function setState(partial: Partial<ProcessState>) {
    state = { ...state, ...partial };
    onStateChange({ ...state });
  }

  function resetState() {
    child = null;
    shutdownResolve = null;
    shuttingDown = false;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  // ── 重启逻辑 ──────────────────────────────────────────────

  function attemptRestart() {
    if (shuttingDown) return;

    // 递增重启计数
    const nextCount = state.restartCount + 1;
    setState({ restartCount: nextCount });

    if (nextCount > maxRestarts) {
      setState({ status: "stopped" });
      resetState();
      return;
    }

    // 指数退避：base * 2^(restartCount - 1)
    // 第1次重启 delay = backoffMs, 第2次 delay = backoffMs * 2, ...
    const delay = restartBackoffMs * Math.pow(2, nextCount - 1);

    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (shuttingDown) return;
      if (lastSpawnOpts) {
        doSpawn(lastSpawnOpts);
        setState({
          pid: child?.pid ?? null,
          status: "running",
          startedAt: Date.now(),
        });
      }
    }, delay);
  }

  // ── 实际 spawn 逻辑 ──────────────────────────────────────

  function doSpawn(opts: SpawnOpts) {
    const spawnFn = opts.options?._mockSpawn ?? nodeSpawn;
    const args = opts.args ?? [];
    const spawnArgs: Parameters<typeof nodeSpawn> = [opts.command, args] as any;

    // 如果有额外的 spawn options（例如 cwd, env），透传
    if (opts.options && !opts.options._mockSpawn) {
      spawnArgs.push(opts.options as any);
    }

    child = spawnFn(...spawnArgs) as ChildProcess;

    child.on("error", (err: Error) => {
      setState({
        status: "crashed",
        lastError: err.message,
      });
      attemptRestart();
    });

    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (shuttingDown) {
        // 关闭流程中的退出
        setState({ status: "stopped" });
        child = null;
        if (shutdownResolve) {
          const resolve = shutdownResolve;
          shutdownResolve = null;
          resolve();
        }
        return;
      }

      if (code === 0 || signal === "SIGTERM") {
        setState({ status: "stopped" });
        resetState();
        return;
      }

      // 非正常退出
      setState({ status: "crashed" });
      attemptRestart();
    });
  }

  // ── 公开 API ──────────────────────────────────────────────

  function spawn(opts: SpawnOpts): {
    process: any;
    stdin: any;
    stdout: any;
    stderr: any;
  } {
    lastSpawnOpts = opts;

    setState({ status: "starting" });

    doSpawn(opts);

    setState({
      pid: child!.pid ?? null,
      status: "running",
      startedAt: Date.now(),
    });

    return {
      process: child,
      stdin: child!.stdin,
      stdout: child!.stdout,
      stderr: child!.stderr,
    };
  }

  function getState(): ProcessState {
    return { ...state };
  }

  async function shutdown(timeoutMs: number): Promise<void> {
    if (shuttingDown) {
      // 已经在关闭流程中，等待当前流程结束（带超时保护）
      let check: ReturnType<typeof setInterval> | null = null;
      return Promise.race([
        new Promise<void>((resolve) => {
          check = setInterval(() => {
            if (state.status === "stopped" || !child) {
              clearInterval(check!);
              check = null;
              resolve();
            }
          }, 50);
        }),
        new Promise<void>((resolve) => setTimeout(() => {
          if (check) {
            clearInterval(check);
            check = null;
          }
          resolve();
        }, timeoutMs)),
      ]);
    }

    shuttingDown = true;

    // 取消任何等待中的重启
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }

    if (!child) {
      setState({ status: "stopped" });
      resetState();
      return;
    }

    setState({ status: "stopping" });

    // 发送 SIGTERM
    child.kill("SIGTERM");

    return new Promise<void>((resolve) => {
      shutdownResolve = resolve;

      const timeout = setTimeout(() => {
        // 超时 → 发送 SIGKILL
        if (child) {
          child.kill("SIGKILL");
        }
        setState({ status: "stopped" });
        child = null;
        const r = shutdownResolve;
        shutdownResolve = null;
        r?.();
      }, timeoutMs);
    });
  }

  return { spawn, getState, shutdown };
}
