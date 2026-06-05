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
    reason: "当前使用本地兜底报告。配置评测模型密钥后，可以获得更精确的语法和表达改写原因。",
  }));

  return {
    sessionId: input.sessionId,
    scenarioId: input.scenarioId,
    createdAt: new Date().toISOString(),
    scores,
    summary:
      "这是本地兜底报告，会根据回答轮次和回答长度估算表现。配置 OPENAI_API_KEY 后，可以获得更细致的发音、语法和表达反馈。",
    pronunciationNotes: [
      "回放你最长的一段回答，检查每个关键词是否清晰可懂。",
      "练习把长句拆成更短的意群，减少停顿和犹豫。",
    ],
    grammarNotes: [
      "解释原因、举例或表达偏好时，尽量使用完整句子。",
    ],
    expressionSuggestions: [
      "Add signposting phrases such as 'The main point is...' or 'For example...'.",
    ],
    corrections,
    nextPracticeGoals: [
      "用清晰的开头、细节和收尾回答一个问题。",
      "重新录制一段回答，并有意识地减少长停顿。",
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
