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
        pronunciationNotes: ["减少意群之间的长停顿。"],
        pronunciationDetails: {
          provider: "tencent-soe",
          voiceId: "voice-e2e",
          accuracy: 78,
          fluency: 80,
          completion: 88,
          suggestedScore: 79,
          words: [{ word: "practicing", accuracy: 61 }],
        },
        grammarNotes: ["保持动词时态一致。"],
        expressionSuggestions: ["One example that comes to mind is..."],
        corrections: [
          {
            original: "I want practicing.",
            improved: "I want to practice.",
            reason: "want 后面通常接 to do。",
          },
        ],
        nextPracticeGoals: ["下次面试练习中使用一次 STAR 回答。"],
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "英语口语场景训练" })).toBeVisible();
  await page.getByRole("button", { name: /点餐/ }).click();
  await page.getByRole("button", { name: "开始练习" }).click();
  await expect(page.getByText("现在可以说话")).toBeVisible();
  await expect(page.getByText("请直接开口，说完后等待 AI 回应。")).toBeVisible();
  await page.getByRole("button", { name: "添加演示回答" }).click();
  await page.getByRole("button", { name: "结束并总结" }).click();
  await expect(page.getByRole("heading", { name: "课后总结" })).toBeVisible();
  await expect(page.getByText("总分")).toBeVisible();
  await expect(page.getByRole("heading", { name: "发音细项" })).toBeVisible();
  await expect(page.getByText("practicing 61分")).toBeVisible();
});
