"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { addJudge, deleteJudge, regenerateJudgeCode, renameJudge } from "./actions";
import { DEMO_DAY_RUBRIC, RUBRIC_MAX } from "@/lib/rubric";
import type { Judge, JudgingRow } from "@/lib/judging";

export function JudgingAdmin({
  judges,
  results,
  points,
}: {
  judges: Judge[];
  results: JudgingRow[];
  points: Record<string, number>;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) alert(res.error || "Something went wrong");
    else router.refresh();
  }

  const lead = judges.find((j) => j.is_lead);
  const scored = results.filter((r) => r.average !== null);
  const leader = scored[0];

  function exportCSV() {
    const header = [
      "Rank",
      "Founder",
      "Startup",
      "Average (/100)",
      "Lead judge",
      ...judges.map((j) => j.name),
      ...DEMO_DAY_RUBRIC.map((c) => `${c.name} (avg 1-5)`),
      "Program points",
    ];
    const rows = results.map((r) => [
      r.average === null ? "" : r.rank,
      r.name,
      r.startup_name || "",
      r.average ?? "",
      r.leadScore ?? "",
      ...judges.map((j) => r.byJudge[j.id] ?? ""),
      ...DEMO_DAY_RUBRIC.map((c) => r.criterionAvg[c.key] ?? ""),
      points[r.student_id] ?? 0,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `AIFounderLab_DemoDay_Results_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Demo Day Judging</h1>
          <p className="text-sm text-slate-500">
            Weighted rubric out of {RUBRIC_MAX}. Final score = average of each judge&apos;s complete
            scorecard; ties go to the lead judge. Program points are shown for reference only.
          </p>
        </div>
        <div className="flex gap-2">
          {lead && (
            <a
              href="/judge"
              target="_blank"
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover"
            >
              Open my scorecard ↗
            </a>
          )}
          <button
            onClick={exportCSV}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {leader && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Current leader</p>
          <p className="text-xl font-bold text-navy">
            🏆 {leader.name}
            {leader.startup_name && <span className="font-medium text-slate-600"> · {leader.startup_name}</span>}
            <span className="ml-2 text-amber-800">{leader.average}</span>
          </p>
          {scored[1] && scored[1].rank === leader.rank && (
            <p className="mt-1 text-sm text-amber-800">
              Tied with {scored[1].name} — resolve with the lead judge&apos;s scorecard.
            </p>
          )}
        </div>
      )}

      {/* Results */}
      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Founder</th>
              <th className="px-4 py-3 text-right">Average</th>
              {judges.map((j) => (
                <th key={j.id} className="px-4 py-3 text-right">
                  {j.name}
                  {j.is_lead && " ★"}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Program pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((r) => (
              <Fragment key={r.student_id}>
                <tr
                  onClick={() => setExpanded(expanded === r.student_id ? null : r.student_id)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-bold text-navy">{r.average === null ? "—" : r.rank}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.startup_name || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-navy">
                    {r.average ?? "—"}
                    <p className="text-xs font-normal text-slate-400">
                      {r.completeCount}/{judges.length} judges
                    </p>
                  </td>
                  {judges.map((j) => (
                    <td key={j.id} className="px-4 py-3 text-right text-slate-700">
                      {r.byJudge[j.id] ?? <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-slate-500">{points[r.student_id] ?? 0}</td>
                </tr>
                {expanded === r.student_id && (
                  <tr className="bg-slate-50">
                    <td colSpan={4 + judges.length} className="px-4 py-4">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {DEMO_DAY_RUBRIC.map((c) => (
                          <div key={c.key} className="rounded-lg bg-white p-3 shadow-sm">
                            <p className="text-xs text-slate-500">
                              {c.name} · {c.weight}
                            </p>
                            <p className="text-lg font-bold text-navy">
                              {r.criterionAvg[c.key] ?? "—"}
                              <span className="text-xs font-normal text-slate-400"> / 5</span>
                            </p>
                          </div>
                        ))}
                      </div>
                      {r.comments.length > 0 && (
                        <ul className="mt-3 space-y-1 text-sm text-slate-700">
                          {r.comments.map((c, i) => (
                            <li key={i}>
                              <span className="font-semibold">{c.judge}:</span> {c.comment}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      {/* Judges */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-navy">Judges</h2>
        <p className="mb-4 text-sm text-slate-500">
          Each judge opens <span className="font-mono">/judge</span> on their phone and enters their
          code. Deleting a judge deletes their scorecards.
        </p>
        <ul className="divide-y divide-slate-100">
          {judges.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {j.name}
                  {j.is_lead && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-navy">
                      Lead judge
                    </span>
                  )}
                </p>
                <p className="font-mono text-lg tracking-widest text-navy">{j.access_code}</p>
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  disabled={busy}
                  onClick={() => {
                    const name = prompt("Judge name", j.name);
                    if (name) run(() => renameJudge(j.id, name));
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
                >
                  Rename
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Issue a new code for ${j.name}? The old code stops working.`))
                      run(() => regenerateJudgeCode(j.id));
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
                >
                  New code
                </button>
                {!j.is_lead && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Remove ${j.name} and all their scorecards?`)) run(() => deleteJudge(j.id));
                    }}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const res = await addJudge(newName);
              if (res.ok) setNewName("");
              return res;
            });
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Judge name"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
          <button
            disabled={busy || !newName.trim()}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover disabled:opacity-50"
          >
            Add judge
          </button>
        </form>
      </section>

      {/* Rubric reference */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-navy">Rubric</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {DEMO_DAY_RUBRIC.map((c) => (
            <div key={c.key} className="rounded-lg border border-slate-100 p-3">
              <p className="font-semibold text-slate-900">
                {c.name} <span className="font-normal text-slate-500">· {c.weight} pts</span>
              </p>
              <p className="mb-2 text-sm text-slate-600">{c.question}</p>
              <dl className="space-y-0.5 text-xs text-slate-500">
                {([1, 3, 5] as const).map((n) => (
                  <div key={n} className="flex gap-2">
                    <dt className="w-3 shrink-0 font-semibold">{n}</dt>
                    <dd>{c.anchors[n]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
