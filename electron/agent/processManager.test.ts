import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createProcessManager, type ProcessState } from "./processManager.js";

/**
 * 构建一个模拟的 child_process 模块，返回可控的 mock 子进程。
 *
 * mockChild 是一个 EventEmitter，带有 stdin/stdout/stderr 流属性以及
 * pid / killed / exitCode / kill 方法，足以满足 processManager 的交互而不实际 fork 进程。
 */
function createMockChild() {
  const stdin = new EventEmitter() as any;
  stdin.writable = true;
  stdin.write = vi.fn();
  stdin.end = vi.fn();
  const stdout = new EventEmitter() as any;
  stdout.readable = true;
  const stderr = new EventEmitter() as any;
  stderr.readable = true;

  const child = new EventEmitter() as any;
  child.pid = 12345;
  child.stdin = stdin;
  child.stdout = stdout;
  child.stderr = stderr;
  child.killed = false;
  child.exitCode = null;

  child.kill = vi.fn((_signal?: string) => {
    child.killed = true;
    return true;
  });

  return child;
}

/** 返回一个 returnChild 的 vi.fn() mock spawn 工厂 */
function mockSpawnFactory(returnChild: any) {
  return vi.fn(() => returnChild);
}

describe("createProcessManager({...}).spawn and getState", () => {
  it("returns correct initial state before spawn", () => {
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: vi.fn(),
    });

    const state = pm.getState();
    expect(state.pid).toBeNull();
    expect(state.status).toBe("stopped");
    expect(state.restartCount).toBe(0);
  });

  it("spawn sends state 'starting' then 'running' with pid", () => {
    const states: ProcessState[] = [];
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: (s) => states.push({ ...s }),
    });

    pm.spawn({
      command: "node",
      args: ["--version"],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    expect(states.length).toBe(2);
    expect(states[0].status).toBe("starting");
    expect(states[1].status).toBe("running");
    expect(states[1].pid).toBe(12345);

    const current = pm.getState();
    expect(current.status).toBe("running");
    expect(current.pid).toBe(12345);
  });

  it("spawn returns SpawnedProcess-compatible object", () => {
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: vi.fn(),
    });

    const result = pm.spawn({
      command: "node",
      args: ["--version"],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    expect(result.process).toBeDefined();
    expect(result.stdin).toBe(child.stdin);
    expect(result.stdout).toBe(child.stdout);
    expect(result.stderr).toBe(child.stderr);
    expect(typeof result.process.kill).toBe("function");
  });
});

describe("State transitions via child events", () => {
  it("child exit code 0 → status becomes 'stopped'", () => {
    const states: ProcessState[] = [];
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: (s) => states.push({ ...s }),
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    // 清空 spawn 期间累积的状态
    const statesBefore = states.length;
    child.emit("exit", 0, null);

    expect(states.length).toBeGreaterThan(statesBefore);
    expect(pm.getState().status).toBe("stopped");
  });

  it("child exit non-zero code → status becomes 'crashed'", () => {
    const states: ProcessState[] = [];
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: (s) => states.push({ ...s }),
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    const statesBefore = states.length;
    child.emit("exit", 1, null);

    expect(states.length).toBeGreaterThan(statesBefore);
    expect(pm.getState().status).toBe("crashed");
  });

  it("child SIGTERM exit → status becomes 'stopped'", () => {
    const states: ProcessState[] = [];
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: (s) => states.push({ ...s }),
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    const statesBefore = states.length;
    child.emit("exit", null, "SIGTERM");

    expect(states.length).toBeGreaterThan(statesBefore);
    expect(pm.getState().status).toBe("stopped");
  });

  it("child 'error' event → status becomes 'crashed'", () => {
    const states: ProcessState[] = [];
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: (s) => states.push({ ...s }),
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    const statesBefore = states.length;
    child.emit("error", new Error("spawn ENOENT"));

    expect(states.length).toBeGreaterThan(statesBefore);
    expect(pm.getState().status).toBe("crashed");
    expect(pm.getState().lastError).toBe("spawn ENOENT");
  });
});

describe("crash → restart", () => {
  it("restart count increments on crash", async () => {
    const states: ProcessState[] = [];
    const child1 = createMockChild();
    const child2 = createMockChild();

    let spawnCallCount = 0;
    const dynamicMock = vi.fn(() => {
      spawnCallCount++;
      return spawnCallCount === 1 ? child1 : child2;
    });

    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 10, // 极短延迟，加速测试
      onStateChange: (s) => states.push({ ...s }),
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: dynamicMock },
    });

    // 子进程崩溃
    child1.emit("exit", 1, null);

    // 等待重启
    await vi.waitFor(
      () => {
        expect(pm.getState().status).toBe("running");
      },
      { timeout: 5000 },
    );

    // crash 状态至少被记录了一次
    const crashStates = states.filter((s) => s.status === "crashed");
    expect(crashStates.length).toBeGreaterThanOrEqual(1);

    // restartCount 应 > 0
    expect(pm.getState().restartCount).toBe(1);
  });
});

describe("maxRestarts exceeded → give up", () => {
  it("gives up when restartCount >= maxRestarts", async () => {
    const pm = createProcessManager({
      maxRestarts: 2,
      restartBackoffMs: 10,
      onStateChange: vi.fn(),
    });

    const child1 = createMockChild();
    const child2 = createMockChild();
    const child3 = createMockChild();

    let spawnCallCount = 0;
    const dynamicMock = vi.fn(() => {
      spawnCallCount++;
      if (spawnCallCount === 1) return child1;
      if (spawnCallCount === 2) return child2;
      return child3;
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: dynamicMock },
    });

    // 第一次崩溃 → 重启 1
    child1.emit("exit", 1, null);

    // 等待重启完成（状态变为 running 说明新的子进程已就绪）
    await vi.waitFor(
      () => {
        expect(pm.getState().status).toBe("running");
      },
      { timeout: 5000 },
    );
    expect(pm.getState().restartCount).toBe(1);

    // 第二次崩溃 → 重启 2（达到 maxRestarts）
    child2.emit("exit", 1, null);

    await vi.waitFor(
      () => {
        expect(pm.getState().status).toBe("running");
      },
      { timeout: 5000 },
    );
    expect(pm.getState().restartCount).toBe(2);

    // 第三次崩溃 → 放弃（restartCount 3 > maxRestarts 2，不应再次重启）
    child3.emit("exit", 1, null);

    // 最终状态应为 stopped（放弃重启）
    await vi.waitFor(
      () => {
        expect(pm.getState().status).toBe("stopped");
      },
      { timeout: 5000 },
    );

    expect(spawnCallCount).toBeLessThanOrEqual(3);
    // 第三次崩溃时 restartCount 也会递增到 3，然后检测到超限放弃
    expect(pm.getState().restartCount).toBe(3);
  });
});

describe("shutdown(timeoutMs)", () => {
  it("shutdown() resolves and sets state to 'stopped' (normal exit)", async () => {
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: vi.fn(),
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    // 发起关闭
    const shutdownPromise = pm.shutdown(5000);

    // SIGTERM 应该已发送
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");

    // 子进程正常退出
    child.emit("exit", 0, null);

    await shutdownPromise;

    expect(pm.getState().status).toBe("stopped");
  });

  it("shutdown sends SIGKILL when child does not exit within timeoutMs", async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: vi.fn(),
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    // 发起关闭，但不让子进程退出
    const shutdownPromise = pm.shutdown(5000);

    // SIGTERM 应该已发送
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");

    // 超时：推进时间
    vi.advanceTimersByTime(5000);

    // 此时应发送 SIGKILL
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");

    // 进程仍未退出（SIGKILL 在 unmanaged 模式下不会自动触发 event），
    // 关闭逻辑应标记为 stopped
    await expect(shutdownPromise).resolves.toBeUndefined();
    expect(pm.getState().status).toBe("stopped");

    vi.useRealTimers();
  });

  it("shutdown handles state 'stopping' safely", async () => {
    const child = createMockChild();
    const pm = createProcessManager({
      maxRestarts: 3,
      restartBackoffMs: 2000,
      onStateChange: vi.fn(),
    });

    pm.spawn({
      command: "node",
      args: [],
      options: { _mockSpawn: mockSpawnFactory(child) },
    });

    const shutdownPromise = pm.shutdown(5000);

    // 在 shutting down 过程中再次调用 shutdown 不应崩溃
    const secondShutdown = pm.shutdown(1000);

    child.emit("exit", 0, null);

    await Promise.all([shutdownPromise, secondShutdown]);

    expect(pm.getState().status).toBe("stopped");
  });
});
