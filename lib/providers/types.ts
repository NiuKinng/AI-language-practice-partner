import type {
  AssessmentReport,
  CorrectionMode,
  Level,
  ScenarioId,
  TranscriptTurn,
  TurnTiming,
  VoiceName,
} from "@/lib/types";

export type VoiceProviderId = "openai-realtime" | "aliyun-qwen-omni";
export type AssessmentProviderId = "openai-assessment";
export type PronunciationProviderId = "demo" | "tencent-soe";

export interface RealtimeSessionInput {
  scenarioId: ScenarioId;
  level: Level;
  correctionMode: CorrectionMode;
  voice: VoiceName;
}

export interface RealtimeSessionResult {
  provider: VoiceProviderId;
  demo: boolean;
  clientSecret: string;
  sessionId: string;
  expiresAt: string;
  model: string;
}

export interface VoiceProvider {
  id: VoiceProviderId;
  createSession(input: RealtimeSessionInput): Promise<RealtimeSessionResult>;
}

export interface AssessmentInput {
  sessionId: string;
  scenarioId: ScenarioId;
  transcript: TranscriptTurn[];
  turnTimings: TurnTiming[];
  userLanguageLevel: Level;
}

export interface AssessmentProvider {
  id: AssessmentProviderId;
  createReport(input: AssessmentInput): Promise<AssessmentReport>;
}

export interface PronunciationProvider {
  id: PronunciationProviderId;
}
