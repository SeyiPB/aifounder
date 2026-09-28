"use client";

import { useEffect, useState } from "react";
import { getMyDashboard, updateMyStartup, type MyDashboard } from "./actions";
import { DEMO_DAY_RUBRIC } from "@/lib/rubric";

type Ready = Extract<MyDashboard, { ok: true }>;

const STORAGE_KEY = "afl-student-pin";

const DECK_SECTIONS = [
  "Introduction",
  "Team",
  "Problem",
  "Solution (working prototype)",
  "Market Opportunity",
  "Business Model",
  "Traction (optional)",
  "Marketing & Sales Strategy",
  "Financial Projections",
  "Closing & call to action",
];

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function Me() {
  const [pin, setPin] = useState("");
  const [data, setData] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(p: string) {
    setBusy(true);
    setError("");
    try {
      const res = await getMyDashboard(p);
      if (res.ok) {
        setData(res);
        try {
          localStorage.setItem(STORAGE_KEY, p);
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPin(saved);
        load(saved);
      }
    } catch {}
  }, []);

  function signOut() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setData(null);
    setPin("");
  }

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(pin);
          }}
          className="w-full max-w-sm rounded-2xl bg-white p-8 text-slate-900 shadow-xl"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-accent" />
            <h1 className="text-xl font-bold text-navy">AI Founder Lab</h1>
            <p className="text-sm text-slate-500">Enter your PIN to see your points</p>
          </div>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={4}
            required
            className="mb-6 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl font-bold tracking-widest focus:border-brand focus:outline-none"
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-navy py-2.5 font-semibold text-white hover:bg-navyhover disabled:opacity-50"
          >
            {busy ? "Loading…" : "View my dashboard"}
          </button>
        </form>
      </div>
    );
  }

  const att = data.attendance;
  const sessions = att.present + att.late + att.absent + att.excused;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">AI Founder Lab</p>
          <h1 className="text-2xl font-bold">Hey {data.firstName} 👋</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <button onClick={() => load(pin)} className="text-slate-300 underline">
            Refresh
          </button>
          <button onClick={signOut} className="text-slate-300 underline">
            Sign out
          </button>
        </div>
      </header>

      {/* Headline stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total points" value={data.total} highlight />
        <Stat label={`Week ${data.currentWeek}`} value={data.thisWeek} />
        <Stat label="Your rank" value={`#${data.rank}`} sub={`of ${data.cohortSize}`} />
      </div>

      <StartupCard data={data} pin={pin} onSaved={() => load(pin)} />

      {data.upcoming && (
        <Card title="Next session">
          <p className="font-semibold">
            Day {data.upcoming.dayNumber}: {data.upcoming.title}
          </p>
          <p className="text-sm text-slate-300">
            {fmtDate(data.upcoming.date)} · 5:00–7:00 PM ·{" "}
            {data.upcoming.mode === "in_person" ? "📍 In person at Civic Hall" : "💻 Online"}
          </p>
        </Card>
      )}

      <Card title="Where your points come from">
        {data.byCategory.length === 0 ? (
          <p className="text-sm text-slate-400">No points yet — share an idea, talk to a customer, build something!</p>
        ) : (
          <ul className="space-y-2">
            {data.byCategory.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {c.icon} {c.name}
                  {c.count > 1 && <span className="text-slate-400"> ×{c.count}</span>}
                </span>
                <span className={`font-bold ${c.points < 0 ? "text-rose-400" : "text-accent"}`}>
                  {c.points > 0 ? "+" : ""}
                  {c.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {data.recent.length > 0 && (
        <Card title="Recent activity">
          <ul className="divide-y divide-white/10">
            {data.recent.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div>
                  <p>
                    {r.icon} {r.category}
                  </p>
                  {r.note && <p className="text-xs text-slate-400">{r.note}</p>}
                  <p className="text-xs text-slate-500">{fmtDate(r.date)}</p>
                </div>
                <span className={`font-bold ${r.points < 0 ? "text-rose-400" : "text-accent"}`}>
                  {r.points > 0 ? "+" : ""}
                  {r.points}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Card title="Weekly quizzes">
          {data.quizzes.length === 0 ? (
            <p className="text-sm text-slate-400">Quizzes run live in class every Friday.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.quizzes.map((q) => (
                <li key={q.title} className="flex justify-between gap-3">
                  <span>{q.title}</span>
                  <span className="shrink-0 font-semibold">
                    {q.correct}/{q.total} · <span className="text-accent">+{q.points}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Attendance">
          {sessions === 0 ? (
            <p className="text-sm text-slate-400">Nothing recorded yet.</p>
          ) : (
            <p className="text-sm">
              ✅ {att.present} present · ⏰ {att.late} late · ❌ {att.absent} absent
              {att.excused > 0 && ` · ${att.excused} excused`}
            </p>
          )}
        </Card>
      </div>

      <Card title="Demo Day — how you'll be judged">
        <p className="mb-3 text-sm text-slate-300">
          Judges score each criterion 1–5. The $5,000 winner has the highest weighted score out of 100.
        </p>
        <ul className="space-y-2 text-sm">
          {DEMO_DAY_RUBRIC.map((c) => (
            <li key={c.key}>
              <p className="flex justify-between gap-3 font-semibold">
                <span>{c.name}</span>
                <span className="text-accent">{c.weight}</span>
              </p>
              <p className="text-xs text-slate-400">5 = {c.anchors[5]}</p>
            </li>
          ))}
        </ul>
        <p className="mb-2 mt-5 text-sm font-semibold">Your deck needs:</p>
        <ol className="list-inside list-decimal columns-2 text-xs text-slate-300">
          {DECK_SECTIONS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: number | string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 text-center ${highlight ? "bg-accent text-navy" : "bg-white/5"}`}>
      <p className="text-3xl font-extrabold">{value}</p>
      <p className={`text-xs ${highlight ? "text-navy/70" : "text-slate-400"}`}>
        {label}
        {sub && ` ${sub}`}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/5 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function StartupCard({ data, pin, onSaved }: { data: Ready; pin: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(!data.startupName);
  const [name, setName] = useState(data.startupName || "");
  const [line, setLine] = useState(data.oneLiner || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await updateMyStartup(pin, name, line);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      onSaved();
    } else {
      setError(res.error);
    }
  }

  if (!editing) {
    return (
      <Card title="Your startup">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold">{data.startupName}</p>
            {data.oneLiner && <p className="text-sm text-slate-300">{data.oneLiner}</p>}
          </div>
          <button onClick={() => setEditing(true)} className="text-sm text-slate-300 underline">
            Edit
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Your startup">
      <form onSubmit={save} className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Startup name (a working name is fine)"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-slate-400 focus:border-accent focus:outline-none"
        />
        <input
          value={line}
          onChange={(e) => setLine(e.target.value)}
          maxLength={200}
          placeholder="One-liner: We help [customer] [solve problem] by [solution]"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-accent focus:outline-none"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {data.startupName && (
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-300 underline">
              Cancel
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
