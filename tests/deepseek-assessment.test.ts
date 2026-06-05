import { afterEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());
const mockOpenAI = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
);

vi.mock("openai", () => ({
  default: mockOpenAI,
}));

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  mockCreate.mockReset();
  mockOpenAI.mockClear();
});

describe("deepSeekAssessmentProvider chat completion", () => {
  it("uses DeepSeek OpenAI-compatible chat completions", async () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-secret";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.test";
    process.env.DEEPSEEK_ASSESSMENT_MODEL = "deepseek-test-model";

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              scores: {
                overall: 82,
                pronunciation: 78,
                fluency: 80,
                grammar: 84,
                expression: 81,
                vocabulary: 79,
                taskCompletion: 86,
              },
              summary: "本次回答结构清晰，可以继续加强细节。",
              pronunciationNotes: ["发音整体可懂。"],
              grammarNotes: ["注意时态一致。"],
              expressionSuggestions: ["One example that comes to mind is..."],
              corrections: [
                {
                  original: "I want practicing.",
                  improved: "I want to practice.",
                  reason: "want 后面通常接 to do。",
                },
              ],
              nextPracticeGoals: ["下次练习中补充一个具体例子。"],
            }),
          },
        },
      ],
    });

    const { deepSeekAssessmentProvider } = await import("@/lib/providers/deepseek-assessment");
    const report = await deepSeekAssessmentProvider.createReport({
      sessionId: "session-1",
      scenarioId: "interview",
      transcript: [
        {
          id: "turn-1",
          speaker: "user",
          text: "I want practicing.",
          startedAt: 0,
          endedAt: 1000,
        },
      ],
      turnTimings: [],
      userLanguageLevel: "intermediate",
    });

    expect(mockOpenAI).toHaveBeenCalledWith({
      apiKey: "deepseek-secret",
      baseURL: "https://api.deepseek.test",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "deepseek-test-model",
        response_format: { type: "json_object" },
      }),
    );
    expect(JSON.stringify(mockCreate.mock.calls)).not.toContain("deepseek-secret");
    expect(report.scores.overall).toBe(82);
    expect(report.summary).toContain("结构清晰");
  });
});
