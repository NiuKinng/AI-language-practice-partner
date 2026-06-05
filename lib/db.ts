"use client";

import Dexie, { type Table } from "dexie";
import type { PracticeSessionRecord } from "@/lib/types";

class PracticeDatabase extends Dexie {
  sessions!: Table<PracticeSessionRecord, string>;

  constructor() {
    super("language_practice_partner");
    this.version(1).stores({
      sessions: "id, scenarioId, startedAt, endedAt",
    });
  }
}

export const db = new PracticeDatabase();

export async function savePracticeSession(record: PracticeSessionRecord) {
  await db.sessions.put(record);
}

export async function listPracticeSessions() {
  return db.sessions.orderBy("startedAt").reverse().toArray();
}

export async function clearPracticeSessions() {
  await db.sessions.clear();
}
