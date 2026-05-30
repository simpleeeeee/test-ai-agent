import { expect, test, type Page } from "@playwright/test";

async function installHistorySessionStub(page: Page, title: string, pendingMessages = false) {
  await page.addInitScript(({ sessionTitle, pendingMessages }: { sessionTitle: string; pendingMessages: boolean }) => {
    const testWindow = window as Window & {
      aiTestAssistant?: unknown;
      __resolveHistoryMessages?: (value: unknown) => void;
    };
    testWindow.aiTestAssistant = {
      send: () => undefined,
      invoke: (channel: string) => {
        if (channel === "run:list-sessions") {
          return Promise.resolve([
            {
              sessionId: "run-1",
              customTitle: sessionTitle,
              summary: sessionTitle,
              lastModified: 1717000000000,
            },
          ]);
        }
        if (channel === "run:get-session-messages") {
          if (pendingMessages) {
            return new Promise((resolve) => {
              testWindow.__resolveHistoryMessages = resolve;
            });
          }
          return Promise.resolve([
            {
              type: "user",
              uuid: "user-1",
              session_id: "run-1",
              message: { role: "user", content: "历史问题" },
              parent_tool_use_id: null,
            },
            {
              type: "assistant",
              uuid: "assistant-1",
              session_id: "run-1",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "历史回复" }],
              },
              parent_tool_use_id: null,
            },
          ]);
        }
        if (channel === "settings:get") {
          return Promise.resolve({ baseUrl: "", apiKey: "", model: "" });
        }
        return Promise.resolve(undefined);
      },
      on: () => () => undefined,
    };
  }, { sessionTitle: title, pendingMessages });
}

test("ordinary chat uses high-fidelity Claude Desktop shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("AI 测试助手")).toBeVisible();
  await expect(page.getByText("Claude", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看全部" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "今天想测试什么？" })).toBeVisible();
  await expect(page.getByLabel("消息输入")).toHaveAttribute("placeholder", "向 AI 测试助手提问…");
  await expect(page.getByRole("button", { name: "最小化窗口" })).toBeVisible();

  await expect(page.locator(".claude-sidebar")).toHaveCSS("background-color", "rgb(232, 230, 220)");
  await expect(page.locator(".app-shell")).toHaveCSS("background-color", "rgb(250, 249, 245)");
  await expect(page.locator(".composer-shell")).toHaveCSS("border-radius", "12px");
});

test("sidebar history scrolls internally and long titles stay truncated", async ({ page }) => {
  const longTitle = "Subagent-driven architecture design /superpowers:writing-plans docs\\superpowers\\specs\\2026-05-29 native-session-management-design review";

  await installHistorySessionStub(page, longTitle);

  await page.goto("/");

  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(page.locator(".app-shell")).toHaveCSS("overflow", "hidden");
  await expect(page.locator(".recent-section")).toHaveCSS("overflow", "auto");

  const recentSession = page.getByRole("button", { name: longTitle });
  await expect(recentSession).toBeVisible();
  await expect(recentSession).toHaveCSS("overflow", "hidden");
  await expect(recentSession).toHaveCSS("text-overflow", "ellipsis");
  await expect(recentSession).toHaveCSS("white-space", "nowrap");
});

test("clicking a recent session loads its transcript into the conversation", async ({ page }) => {
  await installHistorySessionStub(page, "订单模块回归测试");

  await page.goto("/");
  await page.getByRole("button", { name: "订单模块回归测试" }).click();

  await expect(page.getByText("历史问题")).toBeVisible();
  await expect(page.getByText("历史回复")).toBeVisible();
  await expect(page.getByRole("main", { name: "对话" })).toContainText("订单模块回归测试");
});

test("clicking a recent session shows a loading banner before the transcript arrives", async ({ page }) => {
  await installHistorySessionStub(page, "订单模块回归测试", true);

  await page.goto("/");
  await page.getByRole("button", { name: "订单模块回归测试" }).click();

  await expect(page.getByRole("status", { name: "正在加载历史会话" })).toBeVisible();
  await expect(page.getByText("正在加载历史会话…")).toBeVisible();

  await page.evaluate(() => {
    const testWindow = window as Window & {
      __resolveHistoryMessages?: (value: unknown) => void;
    };
    testWindow.__resolveHistoryMessages?.([
      {
        type: "user",
        uuid: "user-1",
        session_id: "run-1",
        message: { role: "user", content: "历史问题" },
        parent_tool_use_id: null,
      },
      {
        type: "assistant",
        uuid: "assistant-1",
        session_id: "run-1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "历史回复" }],
        },
        parent_tool_use_id: null,
      },
    ]);
  });

  await expect(page.getByText("历史问题")).toBeVisible();
  await expect(page.getByText("历史回复")).toBeVisible();
  await expect(page.getByRole("status", { name: "正在加载历史会话" })).toHaveCount(0);
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
