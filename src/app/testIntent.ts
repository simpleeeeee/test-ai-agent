/**
 * 检查用户输入是否包含明确的测试执行意图。
 * 用于区分"生成测试计划"和"执行测试"两种对话指令。
 *
 * 规则：以"测试"开头且包含具体模块/功能描述的输入视为测试执行请求，
 * 例如"测试订单模块功能"、"测试登录页面"。
 * 纯聊天或询问性消息（如"你好"、"介绍一下"）不触发测试执行。
 */
export function isExplicitTestExecutionRequest(value: string): boolean {
  if (!value) return false;
  // 以"测试"开头，后跟至少2个汉字（即具体功能描述）
  return /^测试.{2,}/.test(value);
}

/**
 * 检查用户输入是否明确在请求生成测试计划。
 * 仅用于触发计划生成/审批流程，不应对普通聊天或单纯执行测试请求生效。
 */
export function isTestPlanRequest(value: string): boolean {
  if (!value) return false;
  const normalized = value.replace(/\s+/g, "");
  return /(?:生成|制定|创建|编写|输出)?测试计划/.test(normalized) || /测试方案/.test(normalized);
}
