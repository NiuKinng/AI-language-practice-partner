import { buildScenarioInstructions, getScenario } from "@/lib/scenarios";
import type {
  RealtimeSessionInput,
  RealtimeSessionResult,
  VoiceProvider,
} from "@/lib/providers/types";

function getClientSecret(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const data = payload as Record<string, unknown>;
  const direct = data.value;
  const nested = data.client_secret;

  if (typeof direct === "string") return direct;
  if (nested && typeof nested === "object") {
    const value = (nested as Record<string, unknown>).value;
    if (typeof value === "string") return value;
  }

  return undefined;
}

export const openAiRealtimeProvider: VoiceProvider = {
  id: "openai-realtime",
  async createSession(input: RealtimeSessionInput): Promise<RealtimeSessionResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";

    if (!apiKey) {
      return {
        provider: "openai-realtime",
        demo: true,
        clientSecret: "demo-client-secret",
        sessionId: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        model,
      };
    }

    const scenario = getScenario(input.scenarioId);
    const instructions = buildScenarioInstructions(scenario, input.level);
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          instructions,
          audio: {
            output: {
              voice: input.voice,
            },
            input: {
              transcription: {
                model: "gpt-realtime-whisper",
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to create realtime client secret.");
    }

    const payload = await response.json();
    const clientSecret = getClientSecret(payload);
    if (!clientSecret) {
      throw new Error("Realtime session did not include a client secret.");
    }

    return {
      provider: "openai-realtime",
      demo: false,
      clientSecret,
      sessionId: typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
      expiresAt:
        typeof payload.expires_at === "number"
          ? new Date(payload.expires_at * 1000).toISOString()
          : new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      model,
    };
  },
};
