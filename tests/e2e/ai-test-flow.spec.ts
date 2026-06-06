import { expect, test } from "@playwright/test";

test("tester can submit a request and enter test execution mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("AI 测试助手")).toBeVisible();
  await expect(page.getByText("Claude", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看全部" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "最小化窗口" })).toBeVisible();

  await page.getByLabel("消息输入").fill("测试订单模块功能");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.locator(".user-bubble").getByText("测试订单模块功能")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "测试监控台" })).toBeVisible();
  await expect(page.getByText("计划进度")).toBeVisible();
  await expect(page.getByText("MCP 服务")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认计划并执行" })).toBeVisible();
});
