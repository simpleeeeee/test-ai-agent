export type ConnectionState = "connected" | "unverified" | "connecting" | "failed";

export type ConnectionStatus = {
  state: ConnectionState;
  baseUrl: string;
  model: string;
  error?: {
    code: string;
    message: string;
    suggestion: string;
  };
  probedAt: number;
};

type ErrorMapEntry = {
  message: string;
  suggestion: string;
};

const ERROR_MAP: Record<string, ErrorMapEntry> = {
  ENOTFOUND: {
    message: "无法解析 API 网关地址，请检查网络连接或 DNS 配置",
    suggestion: "确认 baseUrl 中的域名是否正确，以及当前网络是否可以访问该地址",
  },
  ECONNREFUSED: {
    message: "API 网关拒绝连接，请检查服务是否正常运行",
    suggestion: "确认目标服务已启动且端口正确，防火墙未阻止连接",
  },
  ETIMEDOUT: {
    message: "连接 API 网关超时，网络可能不稳定或目标服务响应过慢",
    suggestion: "检查网络延迟，或尝试增加超时时间",
  },
  ECONNRESET: {
    message: "API 网关连接被重置，可能是网络中断或服务端主动断开",
    suggestion: "检查网络稳定性，或联系 API 服务提供方确认服务状态",
  },
  TIMEOUT: {
    message: "探测请求超时，API 网关未在预期时间内响应",
    suggestion: "检查网络延迟和 API 网关负载情况，必要时增加超时时间",
  },
  "401": {
    message: "API 鉴权失败（401），请检查认证凭据是否正确",
    suggestion: "确认 ANTHROPIC_AUTH_TOKEN（或 API Key）已正确配置且未过期",
  },
  "403": {
    message: "API 访问被拒绝（403），当前凭据没有访问权限",
    suggestion: "确认 API Key 具备所需接口的调用权限，或联系管理员开通",
  },
};

const GENERIC_ERROR: ErrorMapEntry = {
  message: "API 连通性探测失败，请检查配置和网络连接",
  suggestion: "确认 baseUrl 和认证凭据配置正确，网络可以访问目标地址",
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
  warmQuery: { query: (...args: any[]) => any },
  options: { baseUrl: string; model: string; timeoutMs?: number },
): Promise<ConnectionStatus> {
  const { baseUrl, model, timeoutMs = 10000 } = options;

  const timeoutPromise = new Promise<ConnectionStatus>((resolve) =>
    setTimeout(() => {
      const entry = ERROR_MAP.TIMEOUT;
      resolve({
        state: "failed",
        baseUrl,
        model,
        error: {
          code: "TIMEOUT",
          message: entry.message,
          suggestion: entry.suggestion,
        },
        probedAt: Date.now(),
      });
    }, timeoutMs),
  );

  const probePromise = (async (): Promise<ConnectionStatus> => {
    try {
      await warmQuery.query({
        prompt: "ping",
        options: { max_turns: 1 },
      });

      return {
        state: "connected",
        baseUrl,
        model,
        probedAt: Date.now(),
      };
    } catch (error: unknown) {
      const code = extractErrorCode(error);
      const entry = ERROR_MAP[code] ?? GENERIC_ERROR;

      return {
        state: "failed",
        baseUrl,
        model,
        error: {
          code,
          message: entry.message,
          suggestion: entry.suggestion,
        },
        probedAt: Date.now(),
      };
    }
  })();

  return Promise.race([probePromise, timeoutPromise]);
}
