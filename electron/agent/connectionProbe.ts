import { diagnoseError } from "./errorDiagnostics.js";
import type { ConnectionState, ConnectionStatus } from "../../src/ipc/connectionTypes.js";

export type { ConnectionState, ConnectionStatus };

export type ConnectionProbeQuery = {
  query: (prompt: string) => AsyncGenerator<unknown, void>;
};

function extractErrorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;

    // HTTP 状态码
    if (typeof err.status === "number") {
      return String(err.status);
    }
    if (typeof err.statusCode === "number") {
      return String(err.statusCode);
    }

    // Node.js 系统错误码
    if (typeof err.code === "string") {
      return err.code;
    }

    // 错误消息中提取常见模式
    if (typeof err.message === "string") {
      const msg = err.message;
      if (msg.includes("ENOTFOUND")) return "ENOTFOUND";
      if (msg.includes("ECONNREFUSED")) return "ECONNREFUSED";
      if (msg.includes("ETIMEDOUT")) return "ETIMEDOUT";
      if (msg.includes("ECONNRESET")) return "ECONNRESET";
    }
  }
  return "UNKNOWN";
}

export async function probeConnection(
  warmQuery: ConnectionProbeQuery,
  options: { baseUrl: string; model: string; timeoutMs?: number },
): Promise<ConnectionStatus> {
  const { baseUrl, model, timeoutMs = 10000 } = options;

  const timeoutDiagnostic = diagnoseError({ code: "TIMEOUT" });
  const timeoutPromise = new Promise<ConnectionStatus>((resolve) =>
    setTimeout(() => {
      resolve({
        state: "failed",
        baseUrl,
        model,
        error: {
          code: "TIMEOUT",
          message: timeoutDiagnostic.message,
          suggestion: timeoutDiagnostic.suggestion,
        },
        probedAt: Date.now(),
      });
    }, timeoutMs),
  );

  const probePromise = (async (): Promise<ConnectionStatus> => {
    let query: AsyncGenerator<unknown, void> | undefined;
    try {
      query = warmQuery.query("ping");
      const first = await query.next();

      if (first.done) {
        throw new Error("No response from API");
      }

      return {
        state: "connected",
        baseUrl,
        model,
        probedAt: Date.now(),
      };
    } catch (error: unknown) {
      // [DIAGNOSTIC] 写入诊断文件
      try {
        const fs = await import("node:fs");
        const logPath = (await import("node:path")).join((await import("node:process")).default.cwd(), "diagnostic.log");
        const lines = [
          `[DIAGNOSTIC] === probeConnection caught error ===`,
          `[DIAGNOSTIC]   error: ${String(error)}`,
        ];
        if (error && typeof error === "object") {
          const err = error as Record<string, unknown>;
          lines.push(`[DIAGNOSTIC]   error.code: ${String(err.code)}`);
          lines.push(`[DIAGNOSTIC]   error.status: ${String(err.status)}`);
          lines.push(`[DIAGNOSTIC]   error.statusCode: ${String(err.statusCode)}`);
          lines.push(`[DIAGNOSTIC]   error.message: ${String(err.message)}`);
          lines.push(`[DIAGNOSTIC]   error.name: ${String(err.name)}`);
          lines.push(`[DIAGNOSTIC]   error.constructor.name: ${String((error as any)?.constructor?.name)}`);
        }
        fs.appendFileSync(logPath, lines.join("\n") + "\n", "utf8");
      } catch { /* 诊断自身失败不影响功能 */ }
      const code = extractErrorCode(error);
      const diagnostic = diagnoseError(error);

      return {
        state: "failed",
        baseUrl,
        model,
        error: {
          code,
          message: diagnostic.message,
          suggestion: diagnostic.suggestion,
        },
        probedAt: Date.now(),
      };
    } finally {
      await query?.return?.(undefined);
    }
  })();

  return Promise.race([probePromise, timeoutPromise]);
}
