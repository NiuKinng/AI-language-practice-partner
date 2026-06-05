"use client";

import { useCallback, useRef } from "react";
import { getScenario } from "@/lib/scenarios";
import { usePracticeStore } from "@/lib/store";
import type { AssessmentReport, TranscriptTurn, VoiceName } from "@/lib/types";

interface RealtimeSessionResponse {
  provider?: "openai-realtime" | "aliyun-qwen-omni";
  demo: boolean;
  clientSecret: string;
  sessionId: string;
  expiresAt: string;
  model: string;
  instructions?: string;
  error?: string;
}

function readTextFromEvent(event: Record<string, unknown>) {
  const textCandidates = [
    event.transcript,
    event.text,
    event.delta,
    event.output_text,
    event.item && typeof event.item === "object"
      ? (event.item as Record<string, unknown>).text
      : undefined,
  ];

  return textCandidates.find((value): value is string => typeof value === "string")?.trim();
}

function eventSpeaker(type: string) {
  if (type.includes("input_audio") || type.includes("user")) return "user" as const;
  return "assistant" as const;
}

export function useVoiceSession() {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptBufferRef = useRef(new Map<string, string>());
  const store = usePracticeStore();

  const cleanup = useCallback(() => {
    dataChannelRef.current?.close();
    peerRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    dataChannelRef.current = null;
    peerRef.current = null;
    mediaStreamRef.current = null;
  }, []);

  const addTranscriptTurn = useCallback(
    (speaker: "user" | "assistant", text: string, id = crypto.randomUUID()) => {
      if (!text) return;
      const now = Date.now();
      const turn: TranscriptTurn = {
        id,
        speaker,
        text,
        startedAt: now,
        endedAt: now,
      };
      usePracticeStore.getState().addTurn(turn);
    },
    [],
  );

  const start = useCallback(
    async (voice: VoiceName = "coral") => {
      cleanup();
      const session = usePracticeStore.getState().startLocalSession();
      const scenario = getScenario(store.scenarioId);

      try {
        const response = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId: store.scenarioId,
            level: store.level,
            correctionMode: "post_session",
            voice,
          }),
        });
        const realtime = (await response.json()) as RealtimeSessionResponse;

        if (!response.ok || realtime.error) {
          throw new Error(realtime.error ?? "Failed to create realtime session.");
        }

        if (realtime.demo) {
          usePracticeStore.getState().setStatus("listening");
          addTranscriptTurn("assistant", scenario.openingLine, `${session.id}-opening`);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const peer = new RTCPeerConnection();
        peerRef.current = peer;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        const audio = new Audio();
        audio.autoplay = true;
        remoteAudioRef.current = audio;

        peer.ontrack = (event) => {
          audio.srcObject = event.streams[0];
          usePracticeStore.getState().setStatus("speaking");
        };

        peer.onconnectionstatechange = () => {
          if (peer.connectionState === "connected") {
            usePracticeStore.getState().setStatus("listening");
          }
          if (["failed", "closed", "disconnected"].includes(peer.connectionState)) {
            usePracticeStore.getState().setStatus("idle");
          }
        };

        const dataChannel = peer.createDataChannel(
          realtime.provider === "aliyun-qwen-omni" ? "aliyun-events" : "oai-events",
        );
        dataChannelRef.current = dataChannel;
        dataChannel.onopen = () => {
          dataChannel.send(
            JSON.stringify({
              type: "response.create",
              response: {
                instructions:
                  realtime.instructions ??
                  `Start the ${scenario.titleEn} roleplay now with this opening line: ${scenario.openingLine}`,
              },
            }),
          );
        };
        dataChannel.onmessage = (message) => {
          const event = JSON.parse(message.data) as Record<string, unknown>;
          const type = typeof event.type === "string" ? event.type : "";
          const text = readTextFromEvent(event);
          const itemId =
            (typeof event.item_id === "string" && event.item_id) ||
            (typeof event.response_id === "string" && event.response_id) ||
            crypto.randomUUID();

          if (type.includes("delta") && text) {
            transcriptBufferRef.current.set(
              itemId,
              `${transcriptBufferRef.current.get(itemId) ?? ""}${text}`,
            );
          }

          if ((type.includes("done") || type.includes("completed")) && text) {
            addTranscriptTurn(eventSpeaker(type), text, itemId);
            transcriptBufferRef.current.delete(itemId);
          }

          if (type === "response.done") {
            usePracticeStore.getState().setStatus("listening");
          }
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        const answerSdp =
          realtime.provider === "aliyun-qwen-omni"
            ? await exchangeAliyunOffer(offer.sdp ?? "", realtime.model)
            : await exchangeOpenAiOffer(
                offer.sdp ?? "",
                realtime.model,
                realtime.clientSecret,
              );

        await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (error) {
        cleanup();
        const message =
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "麦克风权限被拒绝。请允许浏览器使用麦克风后重试。"
            : error instanceof Error
              ? error.message
              : "Realtime connection failed.";
        usePracticeStore.getState().setError(message);
      }
    },
    [addTranscriptTurn, cleanup, store.level, store.scenarioId],
  );

  const addDemoUserTurn = useCallback(() => {
    addTranscriptTurn(
      "user",
      "I would like to practice answering clearly, but sometimes I pause when I need to explain details.",
    );
  }, [addTranscriptTurn]);

  const finish = useCallback(async () => {
    const state = usePracticeStore.getState();
    if (!state.session) return;

    cleanup();
    state.setStatus("ending");

    const response = await fetch("/api/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.session.id,
        scenarioId: state.session.scenarioId,
        transcript: state.transcript,
        turnTimings: state.transcript.map((turn) => ({
          turnId: turn.id,
          speaker: turn.speaker,
          durationMs: Math.max(1, turn.endedAt - turn.startedAt),
        })),
        userLanguageLevel: state.session.level,
      }),
    });

    const report = (await response.json()) as AssessmentReport & { error?: string };
    if (!response.ok || report.error) {
      usePracticeStore.getState().setError(report.error ?? "报告生成失败，请稍后重试。");
      return;
    }

    await usePracticeStore.getState().finishSession(report);
  }, [cleanup]);

  return {
    start,
    finish,
    cleanup,
    addDemoUserTurn,
  };
}

async function exchangeAliyunOffer(sdp: string, model: string) {
  const response = await fetch("/api/realtime/aliyun/offer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp, model }),
  });
  const payload = (await response.json()) as { answer?: string; error?: string };

  if (!response.ok || !payload.answer) {
    throw new Error(payload.error ?? "Aliyun realtime WebRTC answer failed.");
  }

  return payload.answer;
}

async function exchangeOpenAiOffer(sdp: string, model: string, clientSecret: string) {
  const endpoints = [
    `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`,
    `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
  ];
  let lastError = "";

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: sdp,
    });

    if (response.ok) {
      return response.text();
    }

    lastError = await response.text();
  }

  throw new Error(lastError || "Realtime WebRTC answer failed.");
}
