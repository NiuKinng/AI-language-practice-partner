"use client";

import { create } from "zustand";
import type {
  AssessmentReport,
  ConnectionStatus,
  Level,
  PracticeSessionRecord,
  ScenarioId,
  TranscriptTurn,
} from "@/lib/types";
import { getScenario } from "@/lib/scenarios";
import { savePracticeSession } from "@/lib/db";

interface PracticeState {
  scenarioId: ScenarioId;
  level: Level;
  status: ConnectionStatus;
  error?: string;
  session?: PracticeSessionRecord;
  transcript: TranscriptTurn[];
  report?: AssessmentReport;
  setScenario: (scenarioId: ScenarioId) => void;
  setLevel: (level: Level) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (message?: string) => void;
  startLocalSession: () => PracticeSessionRecord;
  addTurn: (turn: TranscriptTurn) => void;
  finishSession: (report?: AssessmentReport) => Promise<void>;
  reset: () => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  scenarioId: "interview",
  level: "intermediate",
  status: "idle",
  transcript: [],
  setScenario: (scenarioId) => set({ scenarioId }),
  setLevel: (level) => set({ level }),
  setStatus: (status) => set({ status }),
  setError: (message) => set({ error: message, status: message ? "error" : get().status }),
  startLocalSession: () => {
    const scenario = getScenario(get().scenarioId);
    const session: PracticeSessionRecord = {
      id: crypto.randomUUID(),
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      level: get().level,
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      transcript: [],
    };

    set({
      session,
      transcript: [],
      report: undefined,
      error: undefined,
      status: "connecting",
    });

    return session;
  },
  addTurn: (turn) => {
    const transcript = [...get().transcript, turn];
    set((state) => ({
      transcript,
      session: state.session ? { ...state.session, transcript } : state.session,
    }));
  },
  finishSession: async (report) => {
    const session = get().session;
    if (!session) return;

    const endedAt = new Date();
    const startedAt = new Date(session.startedAt);
    const finished: PracticeSessionRecord = {
      ...session,
      endedAt: endedAt.toISOString(),
      durationSeconds: Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)),
      transcript: get().transcript,
      report,
    };

    await savePracticeSession(finished);
    set({ session: finished, report, status: report ? "report_ready" : "idle" });
  },
  reset: () =>
    set({
      status: "idle",
      error: undefined,
      session: undefined,
      transcript: [],
      report: undefined,
    }),
}));
