"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Clock,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { clearPracticeSessions, listPracticeSessions } from "@/lib/db";
import { scenarios } from "@/lib/scenarios";
import { usePracticeStore } from "@/lib/store";
import { useVoiceSession } from "@/lib/use-voice-session";
import type { PracticeSessionRecord, ScoreSet, VoiceName } from "@/lib/types";

const levelLabels = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
};

const statusText = {
  idle: "准备开始",
  connecting: "连接中",
  listening: "现在可以说话",
  speaking: "AI 回应中，请听完后再说",
  thinking: "等待 AI 开场",
  ending: "生成报告",
  report_ready: "报告已生成",
  error: "需要处理",
};

function ScoreRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function ScorePanel({ scores }: { scores: ScoreSet }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ScoreRow label="总分" value={scores.overall} />
      <ScoreRow label="发音可懂度" value={scores.pronunciation} />
      <ScoreRow label="流利度" value={scores.fluency} />
      <ScoreRow label="语法准确度" value={scores.grammar} />
      <ScoreRow label="表达自然度" value={scores.expression} />
      <ScoreRow label="词汇丰富度" value={scores.vocabulary} />
      <ScoreRow label="场景完成度" value={scores.taskCompletion} />
    </div>
  );
}

function PronunciationDetailsPanel({
  details,
}: {
  details: NonNullable<PracticeSessionRecord["report"]>["pronunciationDetails"];
}) {
  if (!details) return null;

  const weakWords = details.words
    ?.filter((word) => typeof word.accuracy === "number" && word.accuracy < 70)
    .slice(0, 6);

  return (
    <div className="mt-5 rounded-md border bg-secondary p-4">
      <h3 className="font-bold">发音细项</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <ScoreRow label="准确度" value={Math.round(details.accuracy ?? 0)} />
        <ScoreRow label="流利度" value={Math.round(details.fluency ?? 0)} />
        <ScoreRow label="完整度" value={Math.round(details.completion ?? 0)} />
      </div>
      {weakWords && weakWords.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">重点跟读词</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {weakWords.map((word) => (
              <Badge key={`${word.word}-${word.startMs ?? ""}`}>
                {word.word} {word.accuracy ? `${Math.round(word.accuracy)}分` : ""}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const [history, setHistory] = useState<PracticeSessionRecord[]>([]);
  const [voice, setVoice] = useState<VoiceName>("coral");
  const practice = usePracticeStore();
  const voiceSession = useVoiceSession();
  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === practice.scenarioId) ?? scenarios[0],
    [practice.scenarioId],
  );

  useEffect(() => {
    listPracticeSessions().then(setHistory).catch(() => setHistory([]));
  }, [practice.report]);

  const startDisabled =
    practice.status === "connecting" ||
    practice.status === "listening" ||
    practice.status === "speaking";
  const canSpeakNow = practice.status === "listening";
  const assistantSpeaking = practice.status === "speaking";

  async function clearHistory() {
    await clearPracticeSessions();
    setHistory([]);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-4 border-b bg-white/70 px-4 py-5 shadow-soft backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            AI Language Practice Partner
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal md:text-4xl">
            英语口语场景训练
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            选择场景后直接开口练习。对话中少打断，结束后集中给出发音、语法、表达和下一步目标。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-primary/30 bg-primary/10 text-primary">
            Next.js
          </Badge>
          <Badge>Realtime Voice</Badge>
          <Badge>IndexedDB</Badge>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section aria-labelledby="scenario-heading" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="scenario-heading" className="text-xl font-bold">
                  选择练习场景
                </h2>
                <p className="text-sm text-muted-foreground">
                  每个场景都有角色、目标和成功标准。
                </p>
              </div>
              <select
                aria-label="练习难度"
                value={practice.level}
                onChange={(event) =>
                  practice.setLevel(event.target.value as typeof practice.level)
                }
                className="h-11 rounded-md border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="beginner">入门</option>
                <option value="intermediate">进阶</option>
                <option value="advanced">高级</option>
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => practice.setScenario(scenario.id)}
                  className={`rounded-lg border bg-white p-4 text-left shadow-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    practice.scenarioId === scenario.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">{scenario.title}</h3>
                    <Badge>{levelLabels[scenario.difficulty]}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{scenario.titleEn}</p>
                  <p className="mt-3 text-sm leading-6">{scenario.goal}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h2 className="text-xl font-bold">{selectedScenario.title}对话</h2>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {selectedScenario.role}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="AI 声音"
                  value={voice}
                  onChange={(event) => setVoice(event.target.value as VoiceName)}
                  className="h-11 rounded-md border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="coral">Coral</option>
                  <option value="alloy">Alloy</option>
                  <option value="ash">Ash</option>
                  <option value="ballad">Ballad</option>
                  <option value="echo">Echo</option>
                  <option value="sage">Sage</option>
                </select>
                <Button onClick={() => voiceSession.start(voice)} disabled={startDisabled}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  开始练习
                </Button>
                <Button
                  variant="outline"
                  onClick={voiceSession.finish}
                  disabled={!practice.session || practice.status === "ending"}
                >
                  <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                  结束并总结
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
              <div
                aria-live="polite"
                className={`rounded-md border p-4 transition-colors ${
                  canSpeakNow
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : assistantSpeaking
                      ? "border-slate-200 bg-slate-50 text-slate-500"
                      : "bg-secondary"
                }`}
              >
                <p className="text-sm text-muted-foreground">状态</p>
                <div className="mt-2 flex items-center gap-2 text-lg font-bold">
                  {practice.status === "error" ? (
                    <MicOff className="h-5 w-5 text-destructive" aria-hidden="true" />
                  ) : canSpeakNow ? (
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                      <Mic className="relative h-5 w-5" aria-hidden="true" />
                    </span>
                  ) : assistantSpeaking ? (
                    <MicOff className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                  )}
                  {statusText[practice.status]}
                </div>
                {canSpeakNow || assistantSpeaking ? (
                  <p
                    className={`mt-3 rounded-md px-3 py-2 text-sm font-semibold ${
                      canSpeakNow
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {canSpeakNow ? "请直接开口，说完后等待 AI 回应。" : "当前不会收录你的声音。"}
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  开场句：{selectedScenario.openingLine}
                </p>
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  onClick={voiceSession.addDemoUserTurn}
                  disabled={!practice.session}
                >
                  添加演示回答
                </Button>
              </div>

              <div className="min-h-[260px] rounded-md border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">实时转写</h3>
                  <Badge>{practice.transcript.length} 轮</Badge>
                </div>
                {practice.error ? (
                  <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {practice.error}
                  </p>
                ) : null}
                <div className="mt-4 space-y-3">
                  {practice.transcript.length === 0 ? (
                    <p className="text-sm leading-6 text-muted-foreground">
                      开始练习后，这里会显示 AI 与你的语音转写。没有配置 API Key 时，可以使用演示回答体验报告流程。
                    </p>
                  ) : (
                    practice.transcript.map((turn) => (
                      <div
                        key={turn.id}
                        className={`rounded-md p-3 text-sm leading-6 ${
                          turn.speaker === "user"
                            ? "bg-primary/10"
                            : "bg-secondary"
                        }`}
                      >
                        <p className="mb-1 font-semibold">
                          {turn.speaker === "user" ? "你" : "AI"}
                        </p>
                        <p>{turn.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {practice.report ? (
            <section className="rounded-lg border bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="text-xl font-bold">课后总结</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {practice.report.summary}
              </p>
              <div className="mt-5">
                <ScorePanel scores={practice.report.scores} />
              </div>
              <PronunciationDetailsPanel details={practice.report.pronunciationDetails} />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-bold">纠错与替代表达</h3>
                  <div className="mt-3 space-y-3">
                    {practice.report.corrections.map((item, index) => (
                      <div key={`${item.original}-${index}`} className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">{item.original}</p>
                        <p className="mt-2 font-semibold">{item.improved}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold">下一次练习目标</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {practice.report.nextPracticeGoals.map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-bold">本地历史</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              记录保存在当前浏览器 IndexedDB。
            </p>
            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">还没有完成的练习。</p>
              ) : (
                history.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{item.scenarioTitle}</p>
                      <Badge>{item.report?.scores.overall ?? "-"} 分</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(item.startedAt).toLocaleString()} · {item.durationSeconds}s
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={clearHistory} disabled={history.length === 0}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                清空
              </Button>
              <Button variant="ghost" onClick={practice.reset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                重置
              </Button>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-soft">
            <h2 className="text-lg font-bold">成功标准</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {selectedScenario.successCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
            <h3 className="mt-5 font-bold">关键表达</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedScenario.keyExpressions.map((expression) => (
                <Badge key={expression}>{expression}</Badge>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
