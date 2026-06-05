import { NextResponse } from "next/server";
import { z } from "zod";
import { buildScenarioInstructions, getScenario } from "@/lib/scenarios";

export const runtime = "nodejs";

const requestSchema = z.object({
  scenarioId: z.enum(["interview", "restaurant", "meeting"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  correctionMode: z.literal("post_session").default("post_session"),
  voice: z.enum(["alloy", "ash", "ballad", "coral", "echo", "sage"]).default("coral"),
});

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

async function createClientSecret(input: z.infer<typeof requestSchema>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      demo: true,
      clientSecret: "demo-client-secret",
      sessionId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
    };
  }

  const model = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";
  const scenario = getScenario(input.scenarioId);
  const instructions = buildScenarioInstructions(scenario, input.level);
  const baseBody = {
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
  };

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(baseBody),
  });

  if (response.ok) {
    const payload = await response.json();
    return {
      demo: false,
      clientSecret: getClientSecret(payload),
      sessionId: typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
      expiresAt:
        typeof payload.expires_at === "number"
          ? new Date(payload.expires_at * 1000).toISOString()
          : new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      model,
    };
  }

  const errorText = await response.text();
  throw new Error(errorText || "Failed to create realtime client secret.");
}

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const session = await createClientSecret(input);

    if (!session.clientSecret) {
      return NextResponse.json(
        { error: "Realtime session did not include a client secret." },
        { status: 502 },
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid realtime session request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
