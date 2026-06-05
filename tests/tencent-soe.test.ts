import { afterEach, describe, expect, it } from "vitest";
import { createTencentSoeSignedUrl } from "@/lib/providers/tencent-soe";
import { POST } from "@/app/api/assessment/tencent-soe/sign/route";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Tencent SOE signing", () => {
  it("returns a demo signing payload when credentials are missing", () => {
    delete process.env.TENCENT_SECRET_ID;
    delete process.env.TENCENT_SECRET_KEY;
    delete process.env.TENCENT_SOE_APP_ID;

    const result = createTencentSoeSignedUrl({
      now: 1_700_000_000,
      voiceId: "voice-demo",
    });

    expect(result).toMatchObject({
      provider: "tencent-soe",
      demo: true,
      voiceId: "voice-demo",
      audio: {
        sampleRate: 16000,
        bitDepth: 16,
        channels: 1,
        format: "pcm",
      },
    });
  });

  it("creates a signed WebSocket URL without leaking the secret key", () => {
    process.env.TENCENT_SECRET_ID = "secret-id";
    process.env.TENCENT_SECRET_KEY = "secret-key";
    process.env.TENCENT_SOE_APP_ID = "app-123";

    const result = createTencentSoeSignedUrl({
      now: 1_700_000_000,
      nonce: 42,
      voiceId: "voice-123",
      refText: "I want to practice English.",
    });

    const url = new URL(result.wsUrl);
    expect(result.demo).toBe(false);
    expect(result.expiresAt).toBe("2023-11-14T22:23:20.000Z");
    expect(url.protocol).toBe("wss:");
    expect(url.hostname).toBe("soe.cloud.tencent.com");
    expect(url.pathname).toBe("/soe/api/app-123");
    expect(url.searchParams.get("secretid")).toBe("secret-id");
    expect(url.searchParams.get("voice_id")).toBe("voice-123");
    expect(url.searchParams.get("server_engine_type")).toBe("16k_en");
    expect(url.searchParams.get("signature")).toBeTruthy();
    expect(result.wsUrl).not.toContain("secret-key");
  });
});

describe("Tencent SOE sign route", () => {
  it("returns a signed payload for the frontend", async () => {
    process.env.TENCENT_SECRET_ID = "secret-id";
    process.env.TENCENT_SECRET_KEY = "secret-key";
    process.env.TENCENT_SOE_APP_ID = "app-123";

    const response = await POST(
      new Request("http://localhost/api/assessment/tencent-soe/sign", {
        method: "POST",
        body: JSON.stringify({
          refText: "Tell me about yourself.",
          evalMode: 3,
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.provider).toBe("tencent-soe");
    expect(payload.wsUrl).toContain("wss://soe.cloud.tencent.com/soe/api/app-123");
    expect(JSON.stringify(payload)).not.toContain("secret-key");
  });
});
