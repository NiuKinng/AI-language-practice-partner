export interface AssistantPlaybackGate {
  isAssistantAudioPlaying: boolean;
  queuedSourceCount: number;
}

export function canSendUserAudio(gate: AssistantPlaybackGate) {
  return !gate.isAssistantAudioPlaying && gate.queuedSourceCount === 0;
}
