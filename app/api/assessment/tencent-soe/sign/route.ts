import { NextResponse } from "next/server";
import { z } from "zod";
import { createTencentSoeSignedUrl } from "@/lib/providers/tencent-soe";

export const runtime = "nodejs";

const requestSchema = z.object({
  refText: z.string().optional(),
  evalMode: z.number().int().min(0).max(8).default(3),
  scoreCoeff: z.number().min(1).max(4).default(1.5),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const signed = createTencentSoeSignedUrl(input);

    return NextResponse.json(signed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Tencent SOE sign request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
