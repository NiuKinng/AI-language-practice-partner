export interface ClientTurnDetectionConfig {
  speechThreshold: number;
  minSpeechMs: number;
  endSilenceMs: number;
}

export interface ClientTurnDetectionState {
  isSpeaking: boolean;
  speechStartedAt?: number;
  lastSpeechAt?: number;
  accumulatedSpeechMs: number;
  hasValidSpeech: boolean;
  hasSubmitted: boolean;
}

export const defaultClientTurnDetectionConfig: ClientTurnDetectionConfig = {
  speechThreshold: 0.012,
  minSpeechMs: 450,
  endSilenceMs: 3000,
};

export function createClientTurnDetectionState(): ClientTurnDetectionState {
  return {
    isSpeaking: false,
    accumulatedSpeechMs: 0,
    hasValidSpeech: false,
    hasSubmitted: false,
  };
}

export function calculateRms(input: Float32Array) {
  if (input.length === 0) return 0;

  let sum = 0;
  for (let index = 0; index < input.length; index += 1) {
    const sample = input[index] ?? 0;
    sum += sample * sample;
  }

  return Math.sqrt(sum / input.length);
}

export function updateClientTurnDetection(
  state: ClientTurnDetectionState,
  rms: number,
  nowMs: number,
  config: ClientTurnDetectionConfig = defaultClientTurnDetectionConfig,
) {
  const next: ClientTurnDetectionState = { ...state };

  if (rms >= config.speechThreshold) {
    if (!next.isSpeaking) {
      next.isSpeaking = true;
      next.speechStartedAt = nowMs;
    }

    next.lastSpeechAt = nowMs;
    next.hasSubmitted = false;

    const activeSpeechMs =
      typeof next.speechStartedAt === "number" ? nowMs - next.speechStartedAt : 0;
    const totalSpeechMs = next.accumulatedSpeechMs + activeSpeechMs;

    if (totalSpeechMs >= config.minSpeechMs) {
      next.hasValidSpeech = true;
    }

    return { state: next, shouldSubmit: false };
  }

  if (next.isSpeaking) {
    next.isSpeaking = false;
    if (
      typeof next.speechStartedAt === "number" &&
      typeof next.lastSpeechAt === "number"
    ) {
      next.accumulatedSpeechMs += Math.max(0, next.lastSpeechAt - next.speechStartedAt);
    }
    next.speechStartedAt = undefined;
  }

  const silenceMs =
    typeof next.lastSpeechAt === "number" ? nowMs - next.lastSpeechAt : 0;
  const shouldSubmit =
    next.hasValidSpeech && !next.hasSubmitted && silenceMs >= config.endSilenceMs;

  if (shouldSubmit) {
    next.hasSubmitted = true;
  }

  return { state: next, shouldSubmit };
}

export function resetClientTurnDetection(state: ClientTurnDetectionState) {
  state.isSpeaking = false;
  state.speechStartedAt = undefined;
  state.lastSpeechAt = undefined;
  state.accumulatedSpeechMs = 0;
  state.hasValidSpeech = false;
  state.hasSubmitted = false;
}
