export type ScenarioId = "interview" | "restaurant" | "meeting";

export type Level = "beginner" | "intermediate" | "advanced";

export type CorrectionMode = "post_session";

export type VoiceName = "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage";

export type Speaker = "user" | "assistant";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "thinking"
  | "ending"
  | "report_ready"
  | "error";

export interface Scenario {
  id: ScenarioId;
  title: string;
  titleEn: string;
  role: string;
  goal: string;
  difficulty: Level;
  durationMinutes: number;
  keyExpressions: string[];
  successCriteria: string[];
  openingLine: string;
}

export interface TranscriptTurn {
  id: string;
  speaker: Speaker;
  text: string;
  startedAt: number;
  endedAt: number;
}

export interface TurnTiming {
  turnId: string;
  speaker: Speaker;
  durationMs: number;
  pauseBeforeMs?: number;
}

export interface ScoreSet {
  overall: number;
  pronunciation: number;
  fluency: number;
  grammar: number;
  expression: number;
  vocabulary: number;
  taskCompletion: number;
}

export interface CorrectionItem {
  original: string;
  improved: string;
  reason: string;
}

export interface AssessmentReport {
  sessionId: string;
  scenarioId: ScenarioId;
  createdAt: string;
  scores: ScoreSet;
  summary: string;
  pronunciationNotes: string[];
  pronunciationDetails?: PronunciationDetails;
  grammarNotes: string[];
  expressionSuggestions: string[];
  corrections: CorrectionItem[];
  nextPracticeGoals: string[];
}

export interface PronunciationDetails {
  provider: "demo" | "tencent-soe";
  voiceId?: string;
  accuracy?: number;
  fluency?: number;
  completion?: number;
  suggestedScore?: number;
  words?: PronunciationWord[];
  raw?: unknown;
}

export interface PronunciationWord {
  word: string;
  referenceWord?: string;
  accuracy?: number;
  fluency?: number;
  startMs?: number;
  endMs?: number;
  phones?: PronunciationPhone[];
}

export interface PronunciationPhone {
  phone: string;
  accuracy?: number;
}

export interface PracticeSessionRecord {
  id: string;
  scenarioId: ScenarioId;
  scenarioTitle: string;
  level: Level;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  transcript: TranscriptTurn[];
  report?: AssessmentReport;
}
