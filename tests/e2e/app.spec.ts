import { expect, test } from "@playwright/test";

test("scenario practice flow reaches report summary", async ({ page }) => {
  await page.route("**/api/realtime/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        demo: true,
        clientSecret: "demo",
        sessionId: "demo-session",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        model: "gpt-realtime",
      }),
    });
  });

  await page.route("**/api/assessment", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "demo-session",
        scenarioId: "interview",
        createdAt: new Date().toISOString(),
        scores: {
          overall: 82,
          pronunciation: 78,
          fluency: 80,
          grammar: 84,
          expression: 81,
          vocabulary: 79,
          taskCompletion: 86,
        },
        summary: "你能完成核心回答，下一步可以让例子更具体。",
        pronunciationNotes: ["Reduce long pauses between thought groups."],
        grammarNotes: ["Keep verb tense consistent."],
        expressionSuggestions: ["One example that comes to mind is..."],
        corrections: [
          {
            original: "I want practicing.",
            improved: "I want to practice.",
            reason: "want 后面通常接 to do。",
          },
        ],
        nextPracticeGoals: ["Use one STAR answer in the next interview practice."],
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "英语口语场景训练" })).toBeVisible();
  await page.getByRole("button", { name: /点餐/ }).click();
  await page.getByRole("button", { name: "开始练习" }).click();
  await expect(page.getByText("正在聆听")).toBeVisible();
  await page.getByRole("button", { name: "添加演示回答" }).click();
  await page.getByRole("button", { name: "结束并总结" }).click();
  await expect(page.getByRole("heading", { name: "课后总结" })).toBeVisible();
  await expect(page.getByText("总分")).toBeVisible();
});
