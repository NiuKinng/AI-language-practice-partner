import { NextResponse } from "next/server";
import { z } from "zod";
import { getAssessmentProvider } from "@/lib/providers";

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
  sessionId: z.string(),
  scenarioId: z.enum(["interview", "restaurant", "meeting"]),
  createdAt: z.string(),
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

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const report = await getAssessmentProvider().createReport(input);

    return NextResponse.json(reportSchema.parse(report));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
