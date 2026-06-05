export interface AssistantPlaybackGate {
  isAssistantAudioPlaying: boolean;
  isAssistantResponsePending?: boolean;
  queuedSourceCount: number;
}

export function canSendUserAudio(gate: AssistantPlaybackGate) {
  return (
    !gate.isAssistantResponsePending &&
    !gate.isAssistantAudioPlaying &&
    gate.queuedSourceCount === 0
  );
}
