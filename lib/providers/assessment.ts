import OpenAI from "openai";
import { buildFallbackAssessment, normalizeScoreSet } from "@/lib/assessment";
import { getScenario } from "@/lib/scenarios";
import type { AssessmentProvider } from "@/lib/providers/types";

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
  summary: "short bilingual summary in Chinese with key English terms where useful",
  pronunciationNotes: ["2-4 notes"],
  grammarNotes: ["2-4 notes"],
  expressionSuggestions: ["3-5 natural alternatives"],
  corrections: [
    {
      original: "learner sentence",
      improved: "more natural sentence",
      reason: "brief Chinese explanation",
    },
  ],
  nextPracticeGoals: ["3 focused goals"],
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
      return buildFallbackAssessment({
        sessionId: input.sessionId,
        scenarioId: input.scenarioId,
        transcript: input.transcript,
      });
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
            "You are an expert English speaking coach. Return strict JSON only. Score each dimension from 1 to 100. Be specific, kind, and action-oriented. Do not invent phoneme-level claims; use pronunciation notes based on intelligibility and fluency evidence.",
        },
        {
          role: "user",
          content: JSON.stringify({
            expectedShape: reportShape,
            scenario,
            userLanguageLevel: input.userLanguageLevel,
            turnTimings: input.turnTimings,
            transcript: compactTranscript(input.transcript),
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = JSON.parse(content);

    return {
      sessionId: input.sessionId,
      scenarioId: input.scenarioId,
      createdAt: new Date().toISOString(),
      ...parsed,
      scores: normalizeScoreSet(parsed.scores),
    };
  },
};
