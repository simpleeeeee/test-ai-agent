/** 连接探测结果状态，供主进程和渲染进程共享使用 */

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
