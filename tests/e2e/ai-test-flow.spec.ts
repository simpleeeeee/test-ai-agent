import { expect, test } from "@playwright/test";

test("ordinary chat stays in chat mode before test execution", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "会话导航" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "测试监控台" })).toHaveCount(0);

  await page.getByLabel("消息输入").fill("帮我分析订单模块测试风险");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("测试监控台")).toHaveCount(0);
});

test("confirmed execution opens the test console", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("消息输入").fill("测试订单模块功能");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "确认计划并执行" }).click();

  await expect(page.getByRole("complementary", { name: "测试监控台" })).toBeVisible();
  await expect(page.getByText("MCP 服务")).toBeVisible();
  await expect(page.getByText("证据")).toBeVisible();
});

test("tool approval and evidence flow renders in test console after execution", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("消息输入").fill("测试订单模块");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "确认计划并执行" }).click();

  await expect(page.getByRole("complementary", { name: "测试监控台" })).toBeVisible();

  await expect(page.getByText("计划进度")).toBeVisible();
  await expect(page.getByText("MCP 服务")).toBeVisible();
  await expect(page.getByText("证据")).toBeVisible();
  await expect(page.getByText("缺陷草稿")).toBeVisible();

  await expect(page.getByRole("button", { name: "确认执行" })).toBeVisible();
  await expect(page.getByRole("button", { name: "停止" })).toBeVisible();
});
