import { describe, expect, it } from "vitest";
import { canSendUserAudio } from "@/lib/audio-gate";

describe("audio gate", () => {
  it("blocks user audio while assistant audio is playing or queued", () => {
    expect(
      canSendUserAudio({
        isAssistantAudioPlaying: false,
        isAssistantResponsePending: true,
        queuedSourceCount: 0,
      }),
    ).toBe(false);

    expect(
      canSendUserAudio({
        isAssistantAudioPlaying: true,
        queuedSourceCount: 0,
      }),
    ).toBe(false);

    expect(
      canSendUserAudio({
        isAssistantAudioPlaying: false,
        queuedSourceCount: 2,
      }),
    ).toBe(false);
  });

  it("allows user audio after assistant playback is fully drained", () => {
    expect(
      canSendUserAudio({
        isAssistantAudioPlaying: false,
        queuedSourceCount: 0,
      }),
    ).toBe(true);
  });
});
