import { afterEach, describe, expect, it } from "vitest";
import {
  getAssessmentProviderId,
  getPronunciationProviderId,
  getVoiceProviderId,
} from "@/lib/providers/config";
import { aliyunQwenOmniProvider } from "@/lib/providers/aliyun-qwen-omni";
import { openAiRealtimeProvider } from "@/lib/providers/openai-realtime";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("provider config", () => {
  it("uses the current OpenAI providers by default", () => {
    delete process.env.VOICE_PROVIDER;
    delete process.env.ASSESSMENT_PROVIDER;
    delete process.env.PRONUNCIATION_PROVIDER;

    expect(getVoiceProviderId()).toBe("openai-realtime");
    expect(getAssessmentProviderId()).toBe("openai-assessment");
    expect(getPronunciationProviderId()).toBe("demo");
  });

  it("accepts planned domestic provider ids without changing current behavior", () => {
    process.env.VOICE_PROVIDER = "aliyun-qwen-omni";
    process.env.PRONUNCIATION_PROVIDER = "tencent-soe";

    expect(getVoiceProviderId()).toBe("aliyun-qwen-omni");
    expect(getPronunciationProviderId()).toBe("tencent-soe");
  });

  it("falls back on unknown provider ids", () => {
    process.env.VOICE_PROVIDER = "unknown";
    process.env.ASSESSMENT_PROVIDER = "unknown";
    process.env.PRONUNCIATION_PROVIDER = "unknown";

    expect(getVoiceProviderId()).toBe("openai-realtime");
    expect(getAssessmentProviderId()).toBe("openai-assessment");
    expect(getPronunciationProviderId()).toBe("demo");
  });
});

describe("openAiRealtimeProvider", () => {
  it("returns a demo realtime session when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const session = await openAiRealtimeProvider.createSession({
      scenarioId: "interview",
      level: "intermediate",
      correctionMode: "post_session",
      voice: "coral",
    });

    expect(session).toMatchObject({
      provider: "openai-realtime",
      demo: true,
      clientSecret: "demo-client-secret",
      model: "gpt-realtime",
    });
  });
});

describe("aliyunQwenOmniProvider", () => {
  it("returns a demo session when Aliyun credentials are missing", async () => {
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.ALIYUN_REALTIME_WS_URL;

    const session = await aliyunQwenOmniProvider.createSession({
      scenarioId: "restaurant",
      level: "beginner",
      correctionMode: "post_session",
      voice: "coral",
    });

    expect(session).toMatchObject({
      provider: "aliyun-qwen-omni",
      demo: true,
      clientSecret: "demo-aliyun-session",
      model: "qwen3.5-omni-plus-realtime",
      transport: "websocket",
      wsUrl: "ws://localhost:3101/aliyun/realtime",
    });
    expect(session.instructions).toContain("Ordering Food");
  });

  it("returns a WebSocket proxy session when Aliyun credentials are configured", async () => {
    process.env.DASHSCOPE_API_KEY = "dashscope-secret";
    process.env.REALTIME_PROXY_PORT = "3999";

    const session = await aliyunQwenOmniProvider.createSession({
      scenarioId: "interview",
      level: "advanced",
      correctionMode: "post_session",
      voice: "coral",
    });

    expect(session).toMatchObject({
      provider: "aliyun-qwen-omni",
      demo: false,
      clientSecret: "server-proxied",
      transport: "websocket",
      wsUrl: "ws://localhost:3999/aliyun/realtime",
    });
    expect(JSON.stringify(session)).not.toContain("dashscope-secret");
  });
});
