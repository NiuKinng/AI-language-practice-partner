import { buildScenarioInstructions, getScenario } from "@/lib/scenarios";
import type {
  RealtimeSessionInput,
  RealtimeSessionResult,
  VoiceProvider,
} from "@/lib/providers/types";

export function getAliyunRealtimeEndpoint() {
  return process.env.ALIYUN_REALTIME_ENDPOINT?.replace(/\/$/, "");
}

export function getAliyunRealtimeModel() {
  return process.env.ALIYUN_REALTIME_MODEL ?? "qwen3.5-omni-plus-realtime";
}

export function isAliyunRealtimeConfigured() {
  return Boolean(process.env.DASHSCOPE_API_KEY && getAliyunRealtimeEndpoint());
}

export const aliyunQwenOmniProvider: VoiceProvider = {
  id: "aliyun-qwen-omni",
  async createSession(input: RealtimeSessionInput): Promise<RealtimeSessionResult> {
    const model = getAliyunRealtimeModel();
    const scenario = getScenario(input.scenarioId);
    const instructions = buildScenarioInstructions(scenario, input.level);

    if (!isAliyunRealtimeConfigured()) {
      return {
        provider: "aliyun-qwen-omni",
        demo: true,
        clientSecret: "demo-aliyun-session",
        sessionId: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        model,
        instructions,
      };
    }

    return {
      provider: "aliyun-qwen-omni",
      demo: false,
      clientSecret: "server-proxied",
      sessionId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      model,
      instructions,
    };
  },
};
