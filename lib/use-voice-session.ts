"use client";

import { useCallback, useRef } from "react";
import { canSendUserAudio } from "@/lib/audio-gate";
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
  transport?: "webrtc" | "websocket";
  wsUrl?: string;
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

interface AliyunAudioOutputState {
  nextTime: number;
  sources: Set<AudioBufferSourceNode>;
  isAssistantAudioPlaying: boolean;
  isAssistantResponseComplete: boolean;
}

export function useVoiceSession() {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputTimeRef = useRef(0);
  const transcriptBufferRef = useRef(new Map<string, string>());
  const store = usePracticeStore();

  const cleanup = useCallback(() => {
    dataChannelRef.current?.close();
    webSocketRef.current?.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    peerRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    dataChannelRef.current = null;
    webSocketRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    peerRef.current = null;
    mediaStreamRef.current = null;
    outputTimeRef.current = 0;
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

        if (realtime.provider === "aliyun-qwen-omni") {
          await startAliyunWebSocketSession(
            realtime,
            scenario.openingLine,
            addTranscriptTurn,
            {
              mediaStreamRef,
              inputAudioContextRef,
              outputAudioContextRef,
              sourceRef,
              processorRef,
              webSocketRef,
            },
          );
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

        const dataChannel = peer.createDataChannel("oai-events");
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

        const answerSdp = await exchangeOpenAiOffer(
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
              : "实时语音连接失败。";
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

async function startAliyunWebSocketSession(
  realtime: RealtimeSessionResponse,
  openingLine: string,
  addTranscriptTurn: (speaker: "user" | "assistant", text: string, id?: string) => void,
  refs: {
    mediaStreamRef: { current: MediaStream | null };
    inputAudioContextRef: { current: AudioContext | null };
    outputAudioContextRef: { current: AudioContext | null };
    sourceRef: { current: MediaStreamAudioSourceNode | null };
    processorRef: { current: ScriptProcessorNode | null };
    webSocketRef: { current: WebSocket | null };
  },
) {
  if (!realtime.wsUrl) {
    throw new Error("Aliyun realtime WebSocket URL is missing.");
  }

  const wsUrl = new URL(realtime.wsUrl);
  wsUrl.searchParams.set("model", realtime.model);
  wsUrl.searchParams.set("sessionId", realtime.sessionId);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const inputContext = new AudioContext();
  const outputContext = new AudioContext();
  const source = inputContext.createMediaStreamSource(stream);
  const processor = inputContext.createScriptProcessor(4096, 1, 1);
  const socket = new WebSocket(wsUrl.toString());
  const outputState: AliyunAudioOutputState = {
    nextTime: 0,
    sources: new Set<AudioBufferSourceNode>(),
    isAssistantAudioPlaying: false,
    isAssistantResponseComplete: true,
  };

  refs.mediaStreamRef.current = stream;
  refs.inputAudioContextRef.current = inputContext;
  refs.outputAudioContextRef.current = outputContext;
  refs.sourceRef.current = source;
  refs.processorRef.current = processor;
  refs.webSocketRef.current = socket;

  socket.onopen = () => {
    usePracticeStore.getState().setStatus("listening");
    socket.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions: realtime.instructions,
          modalities: ["text", "audio"],
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          turn_detection: {
            type: "server_vad",
          },
        },
      }),
    );
    socket.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: `Start the roleplay with this opening line: ${openingLine}`,
        },
      }),
    );
  };

  socket.onmessage = async (message) => {
    if (typeof message.data !== "string") return;

    const event = JSON.parse(message.data) as Record<string, unknown>;
    const type = typeof event.type === "string" ? event.type : "";
    const audioDelta =
      typeof event.delta === "string"
        ? event.delta
        : typeof event.audio === "string"
          ? event.audio
          : undefined;

    if (type.includes("response.audio.delta") && audioDelta) {
      outputState.isAssistantAudioPlaying = true;
      outputState.isAssistantResponseComplete = false;
      usePracticeStore.getState().setStatus("speaking");
      await outputContext.resume().catch(() => undefined);
      playPcm16Base64(outputContext, outputState, audioDelta, 24000, () => {
        finishAssistantPlaybackIfReady(outputContext, outputState, socket, true);
      });
    }

    const text = readTextFromEvent(event);
    if ((type.includes("done") || type.includes("completed")) && text) {
      addTranscriptTurn(eventSpeaker(type), text);
    }

    if (type === "response.done" || type === "response.audio.done") {
      outputState.isAssistantResponseComplete = true;
      if (outputState.isAssistantAudioPlaying) {
        finishAssistantPlaybackIfReady(outputContext, outputState, socket, true);
      } else {
        usePracticeStore.getState().setStatus("listening");
      }
    }

    if (type === "error") {
      const error = event.error as { message?: string } | undefined;
      usePracticeStore.getState().setError(error?.message ?? "Aliyun realtime error.");
    }
  };

  socket.onerror = () => {
    usePracticeStore.getState().setError("阿里实时语音代理连接失败，请确认代理服务已启动。");
  };
  socket.onclose = () => {
    if (usePracticeStore.getState().status !== "error") {
      usePracticeStore.getState().setStatus("idle");
    }
  };

  processor.onaudioprocess = (event) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (
      !canSendUserAudio({
        isAssistantAudioPlaying: outputState.isAssistantAudioPlaying,
        queuedSourceCount: outputState.sources.size,
      })
    ) {
      return;
    }

    const input = event.inputBuffer.getChannelData(0);
    const pcm16 = floatTo16BitPcm(downsample(input, inputContext.sampleRate, 16000));
    socket.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: arrayBufferToBase64(pcm16.buffer),
      }),
    );
  };

  source.connect(processor);
  processor.connect(inputContext.destination);
}

function downsample(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) return input;

  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    output[index] = input[Math.floor(index * ratio)] ?? 0;
  }

  return output;
}

function floatTo16BitPcm(input: Float32Array) {
  const output = new Int16Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

function arrayBufferToBase64(buffer: ArrayBufferLike) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Int16Array(bytes.buffer);
}

function finishAssistantPlaybackIfReady(
  context: AudioContext,
  outputState: AliyunAudioOutputState,
  socket: WebSocket,
  playChime: boolean,
) {
  if (!outputState.isAssistantResponseComplete || outputState.sources.size > 0) return;

  outputState.isAssistantAudioPlaying = false;
  outputState.nextTime = context.currentTime;

  if (socket.readyState !== WebSocket.OPEN || usePracticeStore.getState().status !== "speaking") {
    return;
  }

  usePracticeStore.getState().setStatus("listening");
  if (playChime) {
    playReadyChime(context);
  }
}

function playPcm16Base64(
  context: AudioContext,
  outputState: AliyunAudioOutputState,
  base64: string,
  sampleRate: number,
  onQueueDrained: () => void,
) {
  const pcm = base64ToInt16Array(base64);
  const buffer = context.createBuffer(1, pcm.length, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < pcm.length; index += 1) {
    channel[index] = (pcm[index] ?? 0) / 0x8000;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    outputState.sources.delete(source);
    if (outputState.sources.size === 0) {
      onQueueDrained();
    }
  };

  const startAt = Math.max(context.currentTime, outputState.nextTime);
  outputState.sources.add(source);
  source.start(startAt);
  outputState.nextTime = startAt + buffer.duration;
}

function playReadyChime(context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.frequency.setValueAtTime(660, now);
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.18);
}
