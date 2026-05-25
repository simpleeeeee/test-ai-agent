import { expect, test } from "@playwright/test";

test("ordinary chat uses high-fidelity Claude Desktop shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("AI 测试助手")).toBeVisible();
  await expect(page.getByText("Claude", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看全部" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "今天想测试什么？" })).toBeVisible();
  await expect(page.getByLabel("消息输入")).toHaveAttribute("placeholder", "向 AI 测试助手提问…");
  await expect(page.getByRole("button", { name: "最小化窗口" })).toBeVisible();

  await expect(page.locator(".claude-sidebar")).toHaveCSS("background-color", "rgb(244, 239, 231)");
  await expect(page.locator(".app-shell")).toHaveCSS("background-color", "rgb(253, 251, 247)");
  await expect(page.locator(".composer-shell")).toHaveCSS("border-radius", "12px");
});

test("test execution keeps messages and review card in one narrow column", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("消息输入").fill("测试订单模块功能");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "确认计划并执行" }).click();

  await expect(page.getByRole("complementary", { name: "测试监控台" })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认执行" })).toBeVisible();

  const messageColumn = page.locator(".message-column").first();
  await expect(messageColumn).toBeVisible();
  const box = await messageColumn.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(620);

  await expect(page.locator(".window-controls").first()).toBeVisible();
});
