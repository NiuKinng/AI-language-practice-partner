import OpenAI from "openai";
import { buildFallbackAssessment, normalizeScoreSet } from "@/lib/assessment";
import { getScenario } from "@/lib/scenarios";
import type { AssessmentProvider } from "@/lib/providers/types";
import type { AssessmentReport } from "@/lib/types";

const reportShape = {
  scores: {
    overall: 0,
    pronunciation: 0,
    fluency: 0,
    grammar: 0,
    expression: 0,
    vocabulary: 0,
    taskCompletion: 0,
  },
  summary: "用中文写 2-3 句总结；可以保留必要英文术语",
  pronunciationNotes: ["2-4 条中文发音建议"],
  grammarNotes: ["2-4 条中文语法建议"],
  expressionSuggestions: ["3-5 条英文自然表达替换"],
  corrections: [
    {
      original: "learner sentence",
      improved: "more natural sentence",
      reason: "中文解释为什么这样改",
    },
  ],
  nextPracticeGoals: ["3 条中文下次练习目标"],
};

function compactTranscript(turns: Parameters<AssessmentProvider["createReport"]>[0]["transcript"]) {
  return turns
    .map((turn) => `${turn.speaker === "user" ? "Learner" : "Partner"}: ${turn.text}`)
    .join("\n");
}

export const openAiAssessmentProvider: AssessmentProvider = {
  id: "openai-assessment",
  async createReport(input) {
    if (!process.env.OPENAI_API_KEY) {
      return mergePronunciationDetails(
        buildFallbackAssessment({
          sessionId: input.sessionId,
          scenarioId: input.scenarioId,
          transcript: input.transcript,
        }),
        input.pronunciationDetails,
      );
    }

    const scenario = getScenario(input.scenarioId);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_ASSESSMENT_MODEL ?? "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert English speaking coach. Return strict JSON only. Score each dimension from 1 to 100. Use Chinese for summary, pronunciationNotes, grammarNotes, corrections.reason, and nextPracticeGoals. Keep learner quotes in corrections.original unchanged, and keep corrections.improved / expressionSuggestions in natural English. Be specific, kind, and action-oriented. Do not invent phoneme-level claims; use pronunciation notes based on intelligibility and fluency evidence.",
        },
        {
          role: "user",
          content: JSON.stringify({
            expectedShape: reportShape,
            scenario,
            userLanguageLevel: input.userLanguageLevel,
            turnTimings: input.turnTimings,
            transcript: compactTranscript(input.transcript),
            externalPronunciationDetails: input.pronunciationDetails,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = JSON.parse(content);

    return mergePronunciationDetails(
      {
        sessionId: input.sessionId,
        scenarioId: input.scenarioId,
        createdAt: new Date().toISOString(),
        ...parsed,
        scores: normalizeScoreSet(parsed.scores),
      },
      input.pronunciationDetails,
    );
  },
};

function mergePronunciationDetails(
  report: AssessmentReport,
  pronunciationDetails: AssessmentReport["pronunciationDetails"],
): AssessmentReport {
  if (!pronunciationDetails) return report;

  const pronunciationScore =
    pronunciationDetails.suggestedScore ??
    pronunciationDetails.accuracy ??
    report.scores.pronunciation;
  const weakWords =
    pronunciationDetails.words
      ?.filter((word) => typeof word.accuracy === "number" && word.accuracy < 70)
      .slice(0, 5)
      .map((word) => word.word) ?? [];

  return {
    ...report,
    pronunciationDetails,
    scores: {
      ...report.scores,
      pronunciation: normalizeScoreSet({ pronunciation: pronunciationScore }).pronunciation,
    },
    pronunciationNotes: [
      ...report.pronunciationNotes,
      `腾讯 SOE 发音评分已纳入报告：准确度 ${pronunciationDetails.accuracy ?? "-"}，流利度 ${pronunciationDetails.fluency ?? "-"}，完整度 ${pronunciationDetails.completion ?? "-"}。`,
      weakWords.length > 0
        ? `建议重点跟读这些词：${weakWords.join(", ")}。`
        : "本次未识别到明显低分词，可以继续保持完整句跟读练习。",
    ],
  };
}
