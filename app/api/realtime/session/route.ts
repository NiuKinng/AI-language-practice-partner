import { NextResponse } from "next/server";
import { z } from "zod";
import { getVoiceProvider } from "@/lib/providers";

export const runtime = "nodejs";

const requestSchema = z.object({
  scenarioId: z.enum(["interview", "restaurant", "meeting"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  correctionMode: z.literal("post_session").default("post_session"),
  voice: z.enum(["alloy", "ash", "ballad", "coral", "echo", "sage"]).default("coral"),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const session = await getVoiceProvider().createSession(input);

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid realtime session request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
