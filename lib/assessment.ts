import type {
  AssessmentReport,
  CorrectionItem,
  ScenarioId,
  ScoreSet,
  TranscriptTurn,
} from "@/lib/types";

function clampScore(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function buildFallbackAssessment(input: {
  sessionId: string;
  scenarioId: ScenarioId;
  transcript: TranscriptTurn[];
}): AssessmentReport {
  const userTurns = input.transcript.filter((turn) => turn.speaker === "user");
  const wordCount = userTurns
    .flatMap((turn) => turn.text.trim().split(/\s+/).filter(Boolean))
    .length;
  const averageWords = userTurns.length > 0 ? wordCount / userTurns.length : 0;
  const base = clampScore(58 + userTurns.length * 4 + averageWords * 1.2);
  const scores: ScoreSet = {
    overall: base,
    pronunciation: clampScore(base - 4),
    fluency: clampScore(base - 2),
    grammar: clampScore(base + 1),
    expression: clampScore(base),
    vocabulary: clampScore(base - 1),
    taskCompletion: clampScore(base + 3),
  };
  const corrections: CorrectionItem[] = userTurns.slice(0, 2).map((turn) => ({
    original: turn.text,
    improved: turn.text,
    reason:
      "Add the assessment model key to receive precise grammar and expression rewrites for this sentence.",
  }));

  return {
    sessionId: input.sessionId,
    scenarioId: input.scenarioId,
    createdAt: new Date().toISOString(),
    scores,
    summary:
      "This local fallback report estimates performance from turn count and answer length. Configure OPENAI_API_KEY for detailed pronunciation, grammar, and expression feedback.",
    pronunciationNotes: [
      "Replay your longest answer and check whether each content word is clear.",
      "Practice shorter thought groups to reduce hesitation.",
    ],
    grammarNotes: [
      "Use complete sentences when explaining reasons, examples, or preferences.",
    ],
    expressionSuggestions: [
      "Add signposting phrases such as 'The main point is...' or 'For example...'.",
    ],
    corrections,
    nextPracticeGoals: [
      "Answer one question with a clear beginning, detail, and closing sentence.",
      "Record one response again and reduce long pauses.",
    ],
  };
}

export function normalizeScoreSet(scores: Partial<ScoreSet> | undefined) {
  return {
    overall: clampScore(scores?.overall ?? 70),
    pronunciation: clampScore(scores?.pronunciation ?? 70),
    fluency: clampScore(scores?.fluency ?? 70),
    grammar: clampScore(scores?.grammar ?? 70),
    expression: clampScore(scores?.expression ?? 70),
    vocabulary: clampScore(scores?.vocabulary ?? 70),
    taskCompletion: clampScore(scores?.taskCompletion ?? 70),
  };
}
