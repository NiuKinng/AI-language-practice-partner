import OpenAI from "openai";
import { buildFallbackAssessment, normalizeScoreSet } from "@/lib/assessment";
import {
  assessmentReportShape,
  compactTranscript,
  mergePronunciationDetails,
} from "@/lib/providers/assessment";
import { getScenario } from "@/lib/scenarios";
import type { AssessmentProvider } from "@/lib/providers/types";

const defaultBaseUrl = "https://api.deepseek.com";
const defaultModel = "deepseek-chat";

export function getDeepSeekAssessmentConfig() {
  return {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? defaultBaseUrl,
    model: process.env.DEEPSEEK_ASSESSMENT_MODEL ?? defaultModel,
  };
}

export const deepSeekAssessmentProvider: AssessmentProvider = {
  id: "deepseek-assessment",
  async createReport(input) {
    if (!process.env.DEEPSEEK_API_KEY) {
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
    const config = getDeepSeekAssessmentConfig();
    const deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: config.baseURL,
    });
    const completion = await deepseek.chat.completions.create({
      model: config.model,
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
            expectedShape: assessmentReportShape,
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
