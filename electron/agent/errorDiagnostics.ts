export type ErrorDiagnostic = {
  message: string;
  suggestion: string;
  retryable: boolean;
};

export const NETWORK_ERRORS: Record<string, ErrorDiagnostic> = {
  ENOTFOUND: {
    message: "无法解析 API 网关地址，请检查网络连接或 DNS 配置",
    suggestion: "确认 baseUrl 中的域名是否正确，以及当前网络是否可以访问该地址",
    retryable: false,
  },
  ECONNREFUSED: {
    message: "API 网关拒绝连接，请检查服务是否正常运行",
    suggestion: "确认目标服务已启动且端口正确，防火墙未阻止连接",
    retryable: true,
  },
  ETIMEDOUT: {
    message: "连接 API 网关超时，网络可能不稳定或目标服务响应过慢",
    suggestion: "检查网络延迟，或尝试增加超时时间",
    retryable: true,
  },
  ECONNRESET: {
    message: "API 网关连接被重置，可能是网络中断或服务端主动断开",
    suggestion: "检查网络稳定性，或联系 API 服务提供方确认服务状态",
    retryable: true,
  },
  TIMEOUT: {
    message: "请求超时，API 网关未在预期时间内响应",
    suggestion: "检查网络延迟和 API 网关负载情况，必要时增加超时时间",
    retryable: true,
  },
  "401": {
    message: "API Key 无效或已过期（401），鉴权失败",
    suggestion: "确认 API Key 已正确配置且未过期，必要时重新生成",
    retryable: false,
  },
  "403": {
    message: "API 访问被拒绝（403），当前凭据没有访问权限",
    suggestion: "确认 API Key 具备所需接口的调用权限，或联系管理员开通",
    retryable: false,
  },
  "429": {
    message: "API 请求频率过高（429），已达到速率限制",
    suggestion: "请降低请求频率，稍后重试",
    retryable: true,
  },
  "500": {
    message: "API 服务端内部错误（500）",
    suggestion: "服务端出现异常，请稍后重试。如持续出现请联系 API 服务商",
    retryable: true,
  },
  "502": {
    message: "API 网关错误（502），上游服务异常",
    suggestion: "上游服务不可用，请稍后重试",
    retryable: true,
  },
  "503": {
    message: "API 服务暂时不可用（503）",
    suggestion: "服务正在维护或过载中，请稍后重试",
    retryable: true,
  },
};

export const THIRD_PARTY_ERRORS: Record<string, ErrorDiagnostic> = {
  insufficient_balance: {
    message: "账户余额不足，无法完成本次请求",
    suggestion: "请前往 API 服务商平台充值，或联系管理员增加额度",
    retryable: false,
  },
  model_not_found: {
    message: "指定的模型不可用或不存在",
    suggestion: "请检查模型名称是否正确，或切换到其他可用模型",
    retryable: false,
  },
  model_overloaded: {
    message: "模型当前负载过高，暂时无法处理请求",
    suggestion: "请稍后重试，或切换到负载较低的模型",
    retryable: true,
  },
  context_length_exceeded: {
    message: "输入内容超出模型上下文长度限制",
    suggestion: "请缩短输入文本或减少对话轮次后重试",
    retryable: false,
  },
  rate_limit_exceeded: {
    message: "API 调用频率超出限制，请稍后重试",
    suggestion: "当前请求过于频繁，请降低调用频率后重试",
    retryable: true,
  },
  invalid_api_key: {
    message: "API Key 无效，请检查密钥是否正确",
    suggestion: "确认 API Key 已正确配置且未损坏，必要时重新生成",
    retryable: false,
  },
  api_key_expired: {
    message: "API Key 已过期，请更新密钥",
    suggestion: "请前往 API 服务商平台重新生成密钥并更新配置",
    retryable: false,
  },
  content_filtered: {
    message: "请求内容被安全策略拦截",
    suggestion: "请修改输入内容，避免触发内容过滤规则",
    retryable: false,
  },
};

/** HTTP 状态码的匹配正则：从错误消息中提取 401/403/429/500/502/503 */
const HTTP_STATUS_RE = /\b(401|403|429|500|502|503)\b/;

const GENERIC_RESULT: ErrorDiagnostic = {
  message: "发生未知错误",
  suggestion: "请查看日志获取详情",
  retryable: false,
};

/**
 * 将原始错误对象映射为中文错误诊断。
 *
 * 匹配优先级：
 * 1. 如果 raw 包含 `code` 属性且在 NETWORK_ERRORS 或 THIRD_PARTY_ERRORS 中 → 返回对应条目
 * 2. 如果 raw 包含 `message` 属性且含有 HTTP 状态码（401/403/429/500/502/503）→ 返回 NETWORK_ERRORS 对应条目
 * 3. 否则 → 返回通用未知错误消息
 *
 * 调用方无需关心原始英文错误文本，diagnoseError 保证返回纯中文诊断信息。
 */
export function diagnoseError(raw: unknown): ErrorDiagnostic {
  if (raw && typeof raw === "object") {
    const err = raw as Record<string, unknown>;

    // 1. 按 code 精确匹配 —— 同时检查网络错误和第三方错误
    if (typeof err.code === "string") {
      if (NETWORK_ERRORS[err.code]) return NETWORK_ERRORS[err.code];
      if (THIRD_PARTY_ERRORS[err.code]) return THIRD_PARTY_ERRORS[err.code];
    }

    // 2. 从 message 中提取 HTTP 状态码
    if (typeof err.message === "string") {
      const match = err.message.match(HTTP_STATUS_RE);
      if (match && NETWORK_ERRORS[match[1]]) {
        return NETWORK_ERRORS[match[1]];
      }
    }
  }

  // 3. 回退到通用错误
  return GENERIC_RESULT;
}
