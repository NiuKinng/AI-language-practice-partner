import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildFallbackAssessment, normalizeScoreSet } from "@/lib/assessment";
import { getScenario } from "@/lib/scenarios";

export const runtime = "nodejs";

const transcriptTurnSchema = z.object({
  id: z.string(),
  speaker: z.enum(["user", "assistant"]),
  text: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
});

const requestSchema = z.object({
  sessionId: z.string(),
  scenarioId: z.enum(["interview", "restaurant", "meeting"]),
  transcript: z.array(transcriptTurnSchema),
  turnTimings: z
    .array(
      z.object({
        turnId: z.string(),
        speaker: z.enum(["user", "assistant"]),
        durationMs: z.number(),
        pauseBeforeMs: z.number().optional(),
      }),
    )
    .default([]),
  userLanguageLevel: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
});

const reportSchema = z.object({
  scores: z.object({
    overall: z.number(),
    pronunciation: z.number(),
    fluency: z.number(),
    grammar: z.number(),
    expression: z.number(),
    vocabulary: z.number(),
    taskCompletion: z.number(),
  }),
  summary: z.string(),
  pronunciationNotes: z.array(z.string()),
  grammarNotes: z.array(z.string()),
  expressionSuggestions: z.array(z.string()),
  corrections: z.array(
    z.object({
      original: z.string(),
      improved: z.string(),
      reason: z.string(),
    }),
  ),
  nextPracticeGoals: z.array(z.string()),
});

function compactTranscript(turns: z.infer<typeof transcriptTurnSchema>[]) {
  return turns
    .map((turn) => `${turn.speaker === "user" ? "Learner" : "Partner"}: ${turn.text}`)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        buildFallbackAssessment({
          sessionId: input.sessionId,
          scenarioId: input.scenarioId,
          transcript: input.transcript,
        }),
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
            "You are an expert English speaking coach. Return strict JSON only. Score each dimension from 1 to 100. Be specific, kind, and action-oriented. Do not invent phoneme-level claims; use pronunciation notes based on intelligibility and fluency evidence.",
        },
        {
          role: "user",
          content: JSON.stringify({
            expectedShape: {
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
            },
            scenario,
            userLanguageLevel: input.userLanguageLevel,
            turnTimings: input.turnTimings,
            transcript: compactTranscript(input.transcript),
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = reportSchema.parse(JSON.parse(content));

    return NextResponse.json({
      sessionId: input.sessionId,
      scenarioId: input.scenarioId,
      createdAt: new Date().toISOString(),
      ...parsed,
      scores: normalizeScoreSet(parsed.scores),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
