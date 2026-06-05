import { describe, expect, it, vi, afterEach } from "vitest";
import { POST } from "@/app/api/realtime/aliyun/offer/route";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("Aliyun realtime offer route", () => {
  it("proxies SDP offers without returning the DashScope API key", async () => {
    process.env.DASHSCOPE_API_KEY = "dashscope-secret";
    process.env.ALIYUN_REALTIME_ENDPOINT = "https://dashscope-realtime.example.com";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("answer-sdp", {
        status: 200,
        headers: { "Content-Type": "application/sdp" },
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/realtime/aliyun/offer", {
        method: "POST",
        body: JSON.stringify({ sdp: "offer-sdp", model: "qwen-test" }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ answer: "answer-sdp" });
    expect(JSON.stringify(payload)).not.toContain("dashscope-secret");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashscope-realtime.example.com/api/v1/webrtc/realtime?model=qwen-test",
      expect.objectContaining({
        method: "POST",
        body: "offer-sdp",
        headers: expect.objectContaining({
          Authorization: "Bearer dashscope-secret",
          "Content-Type": "application/sdp",
        }),
      }),
    );
  });

  it("returns a configuration error when Aliyun credentials are missing", async () => {
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.ALIYUN_REALTIME_ENDPOINT;

    const response = await POST(
      new Request("http://localhost/api/realtime/aliyun/offer", {
        method: "POST",
        body: JSON.stringify({ sdp: "offer-sdp" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("not configured");
  });
});
