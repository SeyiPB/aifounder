"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  beginQuiz,
  cancelSession,
  endSession,
  getHostState,
  getQuizAnswerKey,
  nextQuestion,
  revealCurrent,
  setQuizStatus,
  startSession,
  type AnswerKeyQuestion,
} from "./actions";
import type { ProgramDay, Quiz } from "@/lib/types";

type QuizRow = {
  quiz: Quiz;
  day: ProgramDay | null;
  questionCount: number;
  activeSession: { id: string; join_code: string; status: string } | null;
};

type HostState = Awaited<ReturnType<typeof getHostState>>;

export function QuizManager({ quizzes }: { quizzes: QuizRow[] }) {
  const router = useRouter();
  const [hostSessionId, setHostSessionId] = useState<string | null>(null);
  const [hostQuizTitle, setHostQuizTitle] = useState("");
  const [busy, setBusy] = useState(false);
  // Answer-key review overlay
  const [reviewTitle, setReviewTitle] = useState<string | null>(null);
  const [reviewQs, setReviewQs] = useState<AnswerKeyQuestion[] | null>(null);

  async function viewAnswers(row: QuizRow) {
    setBusy(true);
    const res = await getQuizAnswerKey(row.quiz.id);
    setBusy(false);
    if (res.ok) {
      setReviewTitle(`${row.day ? `Day ${row.day.day_number}: ` : ""}${row.quiz.title}`);
      setReviewQs(res.questions);
    } else {
      alert(res.error || "Could not load answers");
    }
  }

  async function host(row: QuizRow) {
    if (row.questionCount === 0) {
      alert("This quiz has no questions yet. Add questions before hosting.");
      return;
    }
    setBusy(true);
    const res = await startSession(row.quiz.id);
    setBusy(false);
    if (res.ok && res.sessionId) {
      setHostQuizTitle(row.quiz.title);
      setHostSessionId(res.sessionId);
    } else {
      alert(("error" in res && res.error) || "Could not start session");
    }
  }

  async function toggleStatus(row: QuizRow) {
    setBusy(true);
    const next = row.quiz.status === "done" ? "upcoming" : "done";
    const res = await setQuizStatus(row.quiz.id, next);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error || "Could not update status");
  }

  function closeHost() {
    setHostSessionId(null);
    router.refresh();
  }

  if (reviewQs) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-navy">Answer key — {reviewTitle}</h1>
          <button
            onClick={() => {
              setReviewQs(null);
              setReviewTitle(null);
            }}
            className="text-sm text-slate-500 hover:text-navy"
          >
            ← Back to quizzes
          </button>
        </div>
        <p className="text-sm text-slate-500">
          The correct answer for each question is highlighted in green.
        </p>
        {reviewQs.length === 0 ? (
          <p className="text-slate-400">This quiz has no questions.</p>
        ) : (
          <ol className="space-y-4">
            {reviewQs.map((q, i) => (
              <li
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="mb-3 font-semibold text-navy">
                  {i + 1}. {q.prompt}
                </p>
                <ul className="space-y-2">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                        o.isCorrect
                          ? "bg-emerald-50 font-medium text-emerald-800"
                          : "bg-slate-50 text-slate-600"
                      }`}
                    >
                      <span>{o.isCorrect ? "✅" : "•"}</span>
                      <span>{o.label}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  if (hostSessionId) {
    return (
      <HostConsole
        sessionId={hostSessionId}
        title={hostQuizTitle}
        onClose={closeHost}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Quizzes</h1>
        <p className="text-sm text-slate-500">
          Host a live daily review quiz. Students join at{" "}
          <span className="font-semibold text-navy">/play</span> with the join code + their PIN.
        </p>
      </div>

      <div className="grid gap-3">
        {quizzes.map((row) => (
          <div
            key={row.quiz.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="flex items-center gap-2 font-semibold text-navy">
                <span>
                  {row.day ? `Day ${row.day.day_number}: ` : ""}
                  {row.quiz.title}
                </span>
                {row.quiz.status === "done" ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    ✓ Done
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    Upcoming
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {row.questionCount} question{row.questionCount === 1 ? "" : "s"} ·{" "}
                {row.quiz.points_per_correct} pts each
                {row.activeSession && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">
                    LIVE · {row.activeSession.join_code}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => viewAnswers(row)}
                disabled={busy || row.questionCount === 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                View answers
              </button>
              <button
                onClick={() => toggleStatus(row)}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {row.quiz.status === "done" ? "Mark upcoming" : "Mark done"}
              </button>
              <button
                onClick={() => host(row)}
                disabled={busy}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover disabled:opacity-50"
              >
                {row.activeSession ? "Resume hosting" : "Host live"}
              </button>
            </div>
          </div>
        ))}
        {quizzes.length === 0 && (
          <p className="text-sm text-slate-400">No quizzes yet.</p>
        )}
      </div>
    </div>
  );
}

function HostConsole({
  sessionId,
  title,
  onClose,
}: {
  sessionId: string;
  title: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<HostState | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const s = await getHostState(sessionId);
    setState(s);
  }, [sessionId]);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 3000); // poll live state
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok && res.error) alert(res.error);
    refresh();
  }

  if (!state || !state.ok) {
    return <p className="text-slate-500">Loading session…</p>;
  }

  const totalJoined = state.participants.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy">{title}</h1>
        <button onClick={onClose} className="text-sm text-slate-500 hover:text-navy">
          ← Back to quizzes
        </button>
      </div>

      {/* Join banner */}
      <div className="rounded-2xl bg-navy p-6 text-center text-white">
        <p className="text-sm text-slate-300">Students join at /play with code</p>
        <p className="my-2 text-5xl font-extrabold tracking-widest text-accent">
          {state.joinCode}
        </p>
        <p className="text-sm text-slate-300">…then enter their personal PIN</p>
      </div>

      {/* LOBBY */}
      {state.status === "lobby" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-lg font-semibold text-navy">{totalJoined} joined</p>
          <div className="my-3 flex flex-wrap justify-center gap-2">
            {state.participants.map((p) => (
              <span key={p.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                {p.display_name}
              </span>
            ))}
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => act(() => beginQuiz(sessionId))}
              disabled={busy || totalJoined === 0}
              className="rounded-lg bg-navy px-6 py-2.5 font-semibold text-white hover:bg-navyhover disabled:opacity-50"
            >
              Start quiz
            </button>
            <button
              onClick={() => act(() => cancelSession(sessionId)).then(onClose)}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE */}
      {state.status === "active" && state.currentQuestion && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
            <span>
              Question {state.currentIndex + 1} of {state.questionCount}
            </span>
            <span>
              {state.answeredCount}/{totalJoined} answered
            </span>
          </div>
          <h2 className="mb-4 text-xl font-bold text-navy">{state.currentQuestion.prompt}</h2>

          <div className="space-y-2">
            {state.tally.map((t) => {
              const pct = totalJoined ? Math.round((t.count / totalJoined) * 100) : 0;
              return (
                <div
                  key={t.optionId}
                  className={`rounded-lg border p-3 ${
                    state.revealed && t.isCorrect
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-navy">
                      {state.revealed && t.isCorrect && "✅ "}
                      {t.label}
                    </span>
                    <span className="text-slate-500">
                      {t.count} {state.revealed && `(${pct}%)`}
                    </span>
                  </div>
                  {state.revealed && (
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full ${t.isCorrect ? "bg-emerald-500" : "bg-slate-300"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            {!state.revealed ? (
              <button
                onClick={() => act(() => revealCurrent(sessionId))}
                disabled={busy}
                className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-navy hover:brightness-95 disabled:opacity-50"
              >
                Reveal answer
              </button>
            ) : (
              <button
                onClick={() => act(() => nextQuestion(sessionId))}
                disabled={busy}
                className="rounded-lg bg-navy px-5 py-2.5 font-semibold text-white hover:bg-navyhover disabled:opacity-50"
              >
                {state.currentIndex + 1 >= state.questionCount ? "Finish & award points" : "Next question"}
              </button>
            )}
            <button
              onClick={() => act(() => endSession(sessionId))}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-slate-600 hover:bg-slate-100"
            >
              End now
            </button>
          </div>
        </div>
      )}

      {/* ENDED */}
      {state.status === "ended" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-2xl">🎉</p>
          <p className="mt-2 text-lg font-semibold text-navy">Quiz complete!</p>
          <p className="text-sm text-slate-500">
            Points have been awarded to the leaderboard.
          </p>
          <div className="mt-4 space-y-1">
            {[...state.participants]
              .sort((a, b) => b.total_score - a.total_score)
              .map((p, i) => (
                <div
                  key={p.id}
                  className="mx-auto flex max-w-sm justify-between rounded-lg bg-slate-50 px-4 py-2 text-sm"
                >
                  <span>
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`} {p.display_name}
                  </span>
                  <span className="font-semibold text-navy">{p.total_score} correct</span>
                </div>
              ))}
          </div>
          <button
            onClick={onClose}
            className="mt-5 rounded-lg bg-navy px-6 py-2.5 font-semibold text-white hover:bg-navyhover"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
