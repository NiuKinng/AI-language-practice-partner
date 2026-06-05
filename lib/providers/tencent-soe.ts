import crypto from "node:crypto";

export interface TencentSoeSignInput {
  refText?: string;
  evalMode?: number;
  scoreCoeff?: number;
  voiceId?: string;
  now?: number;
  nonce?: number;
}

export interface TencentSoeSignResult {
  provider: "tencent-soe";
  demo: boolean;
  wsUrl: string;
  voiceId: string;
  expiresAt: string;
  audio: {
    sampleRate: 16000;
    bitDepth: 16;
    channels: 1;
    format: "pcm";
    chunkBytes: 1280;
    chunkMs: 40;
  };
}

const SOE_HOST = "soe.cloud.tencent.com";
const SOE_PATH_PREFIX = "/soe/api";

export function isTencentSoeConfigured() {
  return Boolean(
    process.env.TENCENT_SECRET_ID &&
      process.env.TENCENT_SECRET_KEY &&
      process.env.TENCENT_SOE_APP_ID,
  );
}

function encodeQuery(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function plainQuery(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function createTencentSoeSignedUrl(input: TencentSoeSignInput = {}): TencentSoeSignResult {
  const appId = process.env.TENCENT_SOE_APP_ID;
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const expiresAt = now + 10 * 60;
  const voiceId = input.voiceId ?? crypto.randomUUID();

  if (!appId || !secretId || !secretKey) {
    return {
      provider: "tencent-soe",
      demo: true,
      wsUrl: "wss://soe.cloud.tencent.com/soe/api/demo?demo=1",
      voiceId,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      audio: tencentSoeAudioSpec,
    };
  }

  const params: Record<string, string | number> = {
    eval_mode: input.evalMode ?? 3,
    expired: expiresAt,
    nonce: input.nonce ?? Math.floor(Math.random() * 1_000_000_000),
    score_coeff: input.scoreCoeff ?? 1.5,
    secretid: secretId,
    sentence_info_enabled: 1,
    server_engine_type: "16k_en",
    text_mode: 0,
    timestamp: now,
    voice_format: 0,
    voice_id: voiceId,
  };

  if (input.refText) {
    params.ref_text = input.refText;
  }

  const sortedParams = Object.fromEntries(
    Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
  );
  const path = `${SOE_PATH_PREFIX}/${appId}`;
  const signSource = `${SOE_HOST}${path}?${plainQuery(sortedParams)}`;
  const signature = crypto
    .createHmac("sha1", secretKey)
    .update(signSource)
    .digest("base64");

  return {
    provider: "tencent-soe",
    demo: false,
    wsUrl: `wss://${SOE_HOST}${path}?${encodeQuery({
      ...sortedParams,
      signature,
    })}`,
    voiceId,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    audio: tencentSoeAudioSpec,
  };
}

export const tencentSoeAudioSpec = {
  sampleRate: 16000,
  bitDepth: 16,
  channels: 1,
  format: "pcm",
  chunkBytes: 1280,
  chunkMs: 40,
} as const;
