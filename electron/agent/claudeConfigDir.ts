/**
 * 解析 CLAUDE_CONFIG_DIR。
 * - 打包态：返回 `<appDir>/.claude`
 * - 开发态：返回 null（不覆盖，使用 SDK 默认 ~/.claude）
 */
export function resolveClaudeConfigDir(params: {
  appDir: string;
  isPackaged: boolean;
}): string | null {
  if (!params.isPackaged) return null;
  const normalized = params.appDir.replace(/[/\\]+$/, "");
  if (!normalized) return null;
  return `${normalized}/.claude`;
}
