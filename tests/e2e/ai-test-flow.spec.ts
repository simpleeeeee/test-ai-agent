import { expect, test } from "@playwright/test";

test("tester can submit an order module request and approve MCP access", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("测试目标").fill("测试订单模块功能");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("测试计划")).toBeVisible();
  await page.getByRole("button", { name: "开始执行" }).click();

  await expect(page.getByText("mcp-user.login")).toBeVisible();
  await expect(page.getByText("AI 请求查询订单数据库")).toBeVisible();
  await page.getByRole("button", { name: "允许" }).click();

  await expect(page.getByText("订单状态接口响应")).toBeVisible();
  await expect(page.getByText("订单取消后状态未同步")).toBeVisible();
  await expect(page.getByRole("button", { name: "生成缺陷草稿" })).toBeVisible();
});
