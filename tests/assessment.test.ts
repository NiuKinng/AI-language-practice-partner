import { describe, expect, it } from "vitest";
import { buildFallbackAssessment, normalizeScoreSet } from "@/lib/assessment";

describe("assessment helpers", () => {
  it("normalizes scores into the 1-100 range", () => {
    expect(
      normalizeScoreSet({
        overall: 140,
        pronunciation: -2,
        fluency: 75.6,
      }),
    ).toMatchObject({
      overall: 100,
      pronunciation: 1,
      fluency: 76,
    });
  });

  it("builds a fallback report with required speaking dimensions", () => {
    const report = buildFallbackAssessment({
      sessionId: "session-1",
      scenarioId: "interview",
      transcript: [
        {
          id: "turn-1",
          speaker: "user",
          text: "I managed a project and learned to communicate better.",
          startedAt: 0,
          endedAt: 1000,
        },
      ],
    });

    expect(report.scores).toHaveProperty("pronunciation");
    expect(report.scores).toHaveProperty("fluency");
    expect(report.scores).toHaveProperty("taskCompletion");
    expect(report.nextPracticeGoals.length).toBeGreaterThan(0);
  });
});
