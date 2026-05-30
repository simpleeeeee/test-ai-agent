import { spawn } from "node:child_process";

const DEV_SERVER_URL = "http://127.0.0.1:5173";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const electronCommand = process.platform === "win32" ? "electron.cmd" : "electron";

function spawnTask(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
}

function waitForHttp(url, timeoutMs = 60_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Keep polling until the server is ready.
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 250);
    };
    void poll();
  });
}

function killChild(child) {
  if (!child || child.killed) return;
  try {
    child.kill();
  } catch {
    // Ignore shutdown errors.
  }
}

const vite = spawnTask(npmCommand, ["run", "dev:web"], {
  env: { ...process.env },
});
const electronBuild = spawnTask(npmCommand, ["run", "build:electron"], {
  env: { ...process.env },
});

let electron = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  killChild(electron);
  killChild(vite);
  killChild(electronBuild);
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

vite.on("exit", (code) => {
  if (!shuttingDown && code !== 0) {
    shutdown(code ?? 1);
  }
});

electronBuild.on("exit", (code) => {
  if (!shuttingDown && code !== 0) {
    shutdown(code ?? 1);
  }
});

try {
  await Promise.all([
    waitForHttp(DEV_SERVER_URL),
    new Promise((resolve, reject) => {
      electronBuild.once("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Electron build failed with exit code ${code ?? 1}`));
        }
      });
    }),
  ]);

  electron = spawnTask(electronCommand, ["."], {
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
    },
  });

  electron.on("exit", (code) => {
    shutdown(code ?? 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}
