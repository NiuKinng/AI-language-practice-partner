import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAliyunRealtimeEndpoint,
  getAliyunRealtimeModel,
  isAliyunRealtimeConfigured,
} from "@/lib/providers/aliyun-qwen-omni";

export const runtime = "nodejs";

const requestSchema = z.object({
  sdp: z.string().min(1),
  model: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const endpoint = getAliyunRealtimeEndpoint();

    if (!isAliyunRealtimeConfigured() || !endpoint) {
      return NextResponse.json(
        { error: "Aliyun realtime is not configured." },
        { status: 400 },
      );
    }

    const model = input.model ?? getAliyunRealtimeModel();
    const response = await fetch(
      `${endpoint}/api/v1/webrtc/realtime?model=${encodeURIComponent(model)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/sdp",
        },
        body: input.sdp,
      },
    );

    const answer = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: answer || "Aliyun realtime SDP exchange failed." },
        { status: response.status },
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Aliyun SDP offer.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
