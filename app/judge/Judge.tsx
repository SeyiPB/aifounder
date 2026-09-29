"use client";

import { useEffect, useState } from "react";
import { getJudgeState, saveScorecard, type JudgeState } from "./actions";
import {
  DEMO_DAY_RUBRIC,
  RUBRIC_MAX,
  RUBRIC_SCALE,
  isComplete,
  weightedTotal,
  type Scores,
} from "@/lib/rubric";

type Ready = Extract<JudgeState, { ok: true }>;
type Founder = Ready["founders"][number];

const STORAGE_KEY = "afl-judge-code";

export function Judge() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load(c: string) {
    setBusy(true);
    setError("");
    try {
      const res = await getJudgeState(c);
      if (res.ok) {
        setState(res);
        try {
          localStorage.setItem(STORAGE_KEY, c);
        } catch {}
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Remember the code on this device so a refresh doesn't log the judge out.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCode(saved);
        load(saved);
      }
    } catch {}
  }, []);

  function signOut() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setState(null);
    setCode("");
    setOpenId(null);
  }

  if (!state) {
    return (
      <div className="grid flex-1 place-items-center px-4 py-12">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(code);
          }}
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-accent" />
            <h1 className="text-xl font-bold text-navy">Demo Day Judging</h1>
            <p className="text-sm text-slate-500">Enter your judge code</p>
          </div>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={6}
            required
            className="mb-6 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl font-bold tracking-widest uppercase focus:border-brand focus:outline-none"
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-navy py-2.5 font-semibold text-white hover:bg-navyhover disabled:opacity-50"
          >
            {busy ? "Checking…" : "Start judging"}
          </button>
        </form>
      </div>
    );
  }

  const open = state.founders.find((f) => f.id === openId) || null;
  if (open) {
    return (
      <ScorecardForm
        key={open.id}
        founder={open}
        onBack={() => setOpenId(null)}
        onSave={async (scores, comment) => {
          const res = await saveScorecard(code, open.id, scores, comment);
          if (!res.ok) return res.error;
          setState({
            ...state,
            founders: state.founders.map((f) => (f.id === open.id ? { ...f, scores, comment } : f)),
          });
          setOpenId(null);
          return null;
        }}
      />
    );
  }

  const done = state.founders.filter((f) => isComplete(f.scores)).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            AI Founder Lab · Demo Day
          </p>
          <h1 className="text-2xl font-bold text-navy">
            {state.judgeName}
            {state.isLead && (
              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 align-middle text-xs font-semibold text-navy">
                Lead judge
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">
            {done} of {state.founders.length} scorecards complete
          </p>
        </div>
        <button onClick={signOut} className="text-sm text-slate-500 underline">
          Sign out
        </button>
      </header>

      <ul className="space-y-2">
        {state.founders.map((f) => {
          const complete = isComplete(f.scores);
          const started = Object.keys(f.scores).length > 0;
          return (
            <li key={f.id}>
              <button
                onClick={() => setOpenId(f.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-navy"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{f.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {f.startupName || "Startup name not set"}
                  </p>
                </div>
                {complete ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                    {weightedTotal(f.scores)}
                  </span>
                ) : (
                  <span className="shrink-0 text-sm text-slate-400">{started ? "In progress" : "Score →"}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScorecardForm({
  founder,
  onBack,
  onSave,
}: {
  founder: Founder;
  onBack: () => void;
  onSave: (scores: Scores, comment: string) => Promise<string | null>;
}) {
  const [scores, setScores] = useState<Scores>(founder.scores);
  const [comment, setComment] = useState(founder.comment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const complete = isComplete(scores);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const err = await onSave(scores, comment);
      if (err) setError(err);
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 underline">
        ← All founders
      </button>
      <h1 className="text-2xl font-bold text-navy">{founder.name}</h1>
      <p className="text-slate-600">{founder.startupName || "Startup name not set"}</p>
      {founder.oneLiner && <p className="mt-1 text-sm italic text-slate-500">“{founder.oneLiner}”</p>}
      <p className="mt-3 text-xs text-slate-500">{RUBRIC_SCALE}</p>

      <div className="mt-4 space-y-4">
        {DEMO_DAY_RUBRIC.map((c) => (
          <section key={c.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-900">{c.name}</h2>
              <span className="text-xs text-slate-500">{c.weight} pts</span>
            </div>
            <p className="mb-3 text-sm text-slate-600">{c.question}</p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScores({ ...scores, [c.key]: n })}
                  className={`rounded-lg py-3 text-lg font-bold transition ${
                    scores[c.key] === n
                      ? "bg-navy text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <dl className="mt-3 space-y-1 text-xs text-slate-500">
              {([1, 3, 5] as const).map((n) => (
                <div key={n} className="flex gap-2">
                  <dt className="w-3 shrink-0 font-semibold">{n}</dt>
                  <dd>{c.anchors[n]}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="font-semibold text-slate-900" htmlFor="comment">
            Feedback for the founder <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            placeholder="One strength, one thing to push on…"
          />
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-extrabold text-navy">
              {weightedTotal(scores)}
              <span className="text-sm font-medium text-slate-500"> / {RUBRIC_MAX}</span>
            </p>
            <p className="text-xs text-slate-500">
              {complete
                ? "All criteria scored"
                : `${DEMO_DAY_RUBRIC.length - Object.keys(scores).length} criteria left`}
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-navy px-6 py-3 font-semibold text-white hover:bg-navyhover disabled:opacity-50"
          >
            {saving ? "Saving…" : complete ? "Save scorecard" : "Save draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
