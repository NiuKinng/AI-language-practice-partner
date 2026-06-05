import { openAiAssessmentProvider } from "@/lib/providers/assessment";
import { aliyunQwenOmniProvider } from "@/lib/providers/aliyun-qwen-omni";
import { deepSeekAssessmentProvider } from "@/lib/providers/deepseek-assessment";
import { getAssessmentProviderId, getVoiceProviderId } from "@/lib/providers/config";
import { openAiRealtimeProvider } from "@/lib/providers/openai-realtime";
import type { AssessmentProvider, VoiceProvider } from "@/lib/providers/types";

export function getVoiceProvider(): VoiceProvider {
  const providerId = getVoiceProviderId();

  if (providerId === "openai-realtime") {
    return openAiRealtimeProvider;
  }

  if (providerId === "aliyun-qwen-omni") {
    return aliyunQwenOmniProvider;
  }

  throw new Error(`Voice provider ${providerId} is not implemented yet.`);
}

export function getAssessmentProvider(): AssessmentProvider {
  const providerId = getAssessmentProviderId();

  if (providerId === "openai-assessment") {
    return openAiAssessmentProvider;
  }

  if (providerId === "deepseek-assessment") {
    return deepSeekAssessmentProvider;
  }

  throw new Error(`Assessment provider ${providerId} is not implemented yet.`);
}
