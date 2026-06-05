import type {
  AssessmentProviderId,
  PronunciationProviderId,
  VoiceProviderId,
} from "@/lib/providers/types";

const voiceProviders: VoiceProviderId[] = ["openai-realtime", "aliyun-qwen-omni"];
const assessmentProviders: AssessmentProviderId[] = [
  "openai-assessment",
  "deepseek-assessment",
];
const pronunciationProviders: PronunciationProviderId[] = ["demo", "tencent-soe"];

function pickProvider<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function getVoiceProviderId() {
  return pickProvider(process.env.VOICE_PROVIDER, voiceProviders, "openai-realtime");
}

export function getAssessmentProviderId() {
  return pickProvider(
    process.env.ASSESSMENT_PROVIDER,
    assessmentProviders,
    "openai-assessment",
  );
}

export function getPronunciationProviderId() {
  return pickProvider(
    process.env.PRONUNCIATION_PROVIDER,
    pronunciationProviders,
    "demo",
  );
}
