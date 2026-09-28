"use client";

import { useMemo, useState } from "react";
import { computeRankings } from "@/lib/leaderboard";
import type {
  Attendance,
  PointAward,
  PointCategory,
  ProgramDay,
  Student,
} from "@/lib/types";

type Tab = "final" | "points" | "attendance";

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsView({
  students,
  days,
  categories,
  attendance,
  awards,
}: {
  students: Student[];
  days: ProgramDay[];
  categories: PointCategory[];
  attendance: Attendance[];
  awards: PointAward[];
}) {
  const [tab, setTab] = useState<Tab>("final");

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const dayMap = useMemo(() => new Map(days.map((d) => [d.id, d])), [days]);
  const dayWeek = useMemo(() => new Map(days.map((d) => [d.id, d.week_number])), [days]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // ---- Final ranking (all-time) ----
  const rankings = useMemo(
    () => computeRankings(students, awards, dayWeek, "all", null),
    [students, awards, dayWeek],
  );

  // ---- Points: per-week totals + most-awarded categories ----
  const weekTotals = useMemo(() => {
    // student_id -> { w1, w2, w3, w4, total }
    const map = new Map<string, number[]>();
    students.forEach((s) => map.set(s.id, [0, 0, 0, 0, 0]));
    awards.forEach((a) => {
      const wk = dayWeek.get(a.day_id);
      const row = map.get(a.student_id);
      if (!wk || !row) return;
      row[wk - 1] += a.points_awarded;
      row[4] += a.points_awarded;
    });
    return map;
  }, [students, awards, dayWeek]);

  const topPerWeek = useMemo(() => {
    return [1, 2, 3, 4].map((wk) => {
      const ranked = students
        .map((s) => ({ name: s.name, pts: weekTotals.get(s.id)?.[wk - 1] || 0 }))
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 3);
      return { wk, ranked };
    });
  }, [students, weekTotals]);

  const categoryUsage = useMemo(() => {
    const map = new Map<string, { count: number; points: number }>();
    awards.forEach((a) => {
      const cur = map.get(a.category_id) || { count: 0, points: 0 };
      cur.count += 1;
      cur.points += a.points_awarded;
      map.set(a.category_id, cur);
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ cat: catMap.get(id), ...v }))
      .sort((a, b) => b.count - a.count);
  }, [awards, catMap]);

  // ---- Attendance summary ----
  const attByStudent = useMemo(() => {
    // student_id -> counts
    const map = new Map<string, { present: number; late: number; absent: number; excused: number }>();
    students.forEach((s) => map.set(s.id, { present: 0, late: 0, absent: 0, excused: 0 }));
    attendance.forEach((a) => {
      const row = map.get(a.student_id);
      if (row) row[a.status] += 1;
    });
    return map;
  }, [students, attendance]);

  const attByDay = useMemo(() => {
    return days.map((d) => {
      const recs = attendance.filter((a) => a.day_id === d.id);
      const present = recs.filter((r) => r.status === "present").length;
      const late = recs.filter((r) => r.status === "late").length;
      const pct = students.length
        ? Math.round(((present + late) / students.length) * 100)
        : 0;
      return { day: d, present, late, pct };
    });
  }, [days, attendance, students]);

  // ---- Exports ----
  function exportFinal() {
    const rows: (string | number)[][] = [["Rank", "Student", "Total Points"]];
    rankings.forEach((r) => rows.push([r.rank, r.name, r.total]));
    downloadCSV(`FutureNYC_Final_Rankings_${today()}.csv`, rows);
  }

  function exportPoints() {
    const rows: (string | number)[][] = [
      ["Student", "Week 1", "Week 2", "Week 3", "Week 4", "Total"],
    ];
    students.forEach((s) => {
      const w = weekTotals.get(s.id) || [0, 0, 0, 0, 0];
      rows.push([s.name, w[0], w[1], w[2], w[3], w[4]]);
    });
    downloadCSV(`FutureNYC_Points_By_Week_${today()}.csv`, rows);
  }

  function exportAttendance() {
    const rows: (string | number)[][] = [
      ["Student", "Present", "Late", "Absent", "Excused", "Attendance %"],
    ];
    students.forEach((s) => {
      const c = attByStudent.get(s.id)!;
      const total = days.length || 1;
      const pct = Math.round(((c.present + c.late) / total) * 100);
      rows.push([s.name, c.present, c.late, c.absent, c.excused, `${pct}%`]);
    });
    downloadCSV(`FutureNYC_Attendance_Summary_${today()}.csv`, rows);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "final", label: "🏆 Final Awards" },
    { id: "points", label: "⭐ Points Summary" },
    { id: "attendance", label: "📋 Attendance" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reports</h1>
          <p className="text-sm text-slate-500">
            Summaries for prize determination, points, and attendance.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          🖨 Print
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 print:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* FINAL AWARDS */}
      {tab === "final" && (
        <Section
          title="Final Rankings — All-Time"
          onExport={exportFinal}
          exportLabel="Export rankings CSV"
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 text-right">Total Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankings.map((r, idx) => {
                // Prize = a top-5 *position* with points earned (not everyone tied at 0).
                const isPrize = idx < 5 && r.total > 0;
                return (
                  <tr key={r.student_id} className={isPrize ? "bg-accent/10" : ""}>
                    <td className="py-2 pr-4 font-bold text-navy">
                      {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}
                    </td>
                    <td className="py-2 pr-4">
                      {r.name}
                      {isPrize && (
                        <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-navy">
                          PRIZE
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-bold">{r.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">
            Top 5 (highlighted) win prizes at the end of the program.
          </p>
        </Section>
      )}

      {/* POINTS SUMMARY */}
      {tab === "points" && (
        <div className="space-y-6">
          <Section
            title="Points by Week"
            onExport={exportPoints}
            exportLabel="Export points CSV"
          >
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Student</th>
                  {[1, 2, 3, 4].map((w) => (
                    <th key={w} className="py-2 pr-4 text-right">Wk {w}</th>
                  ))}
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => {
                  const w = weekTotals.get(s.id) || [0, 0, 0, 0, 0];
                  return (
                    <tr key={s.id}>
                      <td className="py-2 pr-4">{s.name}</td>
                      {[0, 1, 2, 3].map((i) => (
                        <td key={i} className="py-2 pr-4 text-right text-slate-600">{w[i]}</td>
                      ))}
                      <td className="py-2 text-right font-bold text-navy">{w[4]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Top Earners per Week">
              <div className="space-y-3">
                {topPerWeek.map(({ wk, ranked }) => (
                  <div key={wk}>
                    <p className="text-xs font-semibold uppercase text-slate-500">Week {wk}</p>
                    <ol className="mt-1 space-y-0.5 text-sm">
                      {ranked.map((r, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{["🥇", "🥈", "🥉"][i]} {r.name}</span>
                          <span className="font-semibold">{r.pts}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Most-Awarded Categories">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4 text-right">Times</th>
                    <th className="py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryUsage.map((u, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4">{u.cat?.icon} {u.cat?.name || "—"}</td>
                      <td className="py-2 pr-4 text-right">{u.count}</td>
                      <td className="py-2 text-right font-semibold">{u.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        </div>
      )}

      {/* ATTENDANCE */}
      {tab === "attendance" && (
        <div className="space-y-6">
          <Section
            title="Attendance by Student"
            onExport={exportAttendance}
            exportLabel="Export attendance CSV"
          >
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4 text-right">Present</th>
                  <th className="py-2 pr-4 text-right">Late</th>
                  <th className="py-2 pr-4 text-right">Absent</th>
                  <th className="py-2 pr-4 text-right">Excused</th>
                  <th className="py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => {
                  const c = attByStudent.get(s.id)!;
                  const pct = Math.round(((c.present + c.late) / (days.length || 1)) * 100);
                  return (
                    <tr key={s.id}>
                      <td className="py-2 pr-4">{s.name}</td>
                      <td className="py-2 pr-4 text-right text-emerald-600">{c.present}</td>
                      <td className="py-2 pr-4 text-right text-amber-600">{c.late}</td>
                      <td className="py-2 pr-4 text-right text-rose-600">{c.absent}</td>
                      <td className="py-2 pr-4 text-right text-slate-500">{c.excused}</td>
                      <td className="py-2 text-right font-bold text-navy">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          <Section title="Attendance by Day">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Day</th>
                  <th className="py-2 pr-4 text-right">Present</th>
                  <th className="py-2 pr-4 text-right">Late</th>
                  <th className="py-2 text-right">% Present</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attByDay.map(({ day, present, late, pct }) => (
                  <tr key={day.id}>
                    <td className="py-2 pr-4">Day {day.day_number}: {day.title}</td>
                    <td className="py-2 pr-4 text-right text-emerald-600">{present}</td>
                    <td className="py-2 pr-4 text-right text-amber-600">{late}</td>
                    <td className="py-2 text-right font-bold text-navy">{pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  onExport,
  exportLabel,
}: {
  title: string;
  children: React.ReactNode;
  onExport?: () => void;
  exportLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-navy">{title}</h2>
        {onExport && (
          <button
            onClick={onExport}
            className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navyhover print:hidden"
          >
            {exportLabel || "Export CSV"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
