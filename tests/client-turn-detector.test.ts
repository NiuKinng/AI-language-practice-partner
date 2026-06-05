import { describe, expect, it } from "vitest";
import {
  calculateRms,
  createClientTurnDetectionState,
  updateClientTurnDetection,
  type ClientTurnDetectionConfig,
} from "@/lib/client-turn-detector";

const config: ClientTurnDetectionConfig = {
  speechThreshold: 0.012,
  minSpeechMs: 450,
  endSilenceMs: 3000,
};

describe("client turn detector", () => {
  it("does not submit while the user is still speaking", () => {
    let state = createClientTurnDetectionState();

    const first = updateClientTurnDetection(state, 0.03, 0, config);
    state = first.state;
    const second = updateClientTurnDetection(state, 0.03, 1200, config);

    expect(first.shouldSubmit).toBe(false);
    expect(second.shouldSubmit).toBe(false);
    expect(second.state.hasValidSpeech).toBe(true);
  });

  it("does not submit during short thinking pauses", () => {
    let state = createClientTurnDetectionState();

    state = updateClientTurnDetection(state, 0.03, 0, config).state;
    state = updateClientTurnDetection(state, 0.03, 600, config).state;
    const pause = updateClientTurnDetection(state, 0.001, 2400, config);

    expect(pause.shouldSubmit).toBe(false);
    expect(pause.state.hasValidSpeech).toBe(true);
  });

  it("submits after valid speech followed by long silence", () => {
    let state = createClientTurnDetectionState();

    state = updateClientTurnDetection(state, 0.03, 0, config).state;
    state = updateClientTurnDetection(state, 0.03, 600, config).state;
    state = updateClientTurnDetection(state, 0.001, 2400, config).state;
    const ended = updateClientTurnDetection(state, 0.001, 3700, config);

    expect(ended.shouldSubmit).toBe(true);
    expect(ended.state.hasSubmitted).toBe(true);
  });

  it("does not submit empty or very short input", () => {
    let state = createClientTurnDetectionState();

    state = updateClientTurnDetection(state, 0.001, 0, config).state;
    state = updateClientTurnDetection(state, 0.03, 100, config).state;
    state = updateClientTurnDetection(state, 0.001, 200, config).state;
    const silence = updateClientTurnDetection(state, 0.001, 5000, config);

    expect(silence.shouldSubmit).toBe(false);
  });

  it("calculates rms from audio samples", () => {
    expect(calculateRms(new Float32Array([0, 0.5, -0.5]))).toBeCloseTo(0.408, 2);
  });
});
