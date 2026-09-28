"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeRankings, computeClimbers, latestWeekWithAwards } from "@/lib/leaderboard";
import type { PointAward, ProgramDay, Student } from "@/lib/types";

const WEEKS: ("all" | number)[] = ["all", 1, 2, 3, 4];
const MEDAL = ["🥇", "🥈", "🥉"];

export function Leaderboard({
  students,
  days,
  initialAwards,
  todayId,
  display,
}: {
  students: Student[];
  days: ProgramDay[];
  initialAwards: PointAward[];
  todayId: string | null;
  display: boolean;
}) {
  const [awards, setAwards] = useState<PointAward[]>(initialAwards);
  const [week, setWeek] = useState<"all" | number>("all");
  const [mode, setMode] = useState<"rank" | "climbers">("rank");
  const [pulse, setPulse] = useState(false);

  const dayWeek = useMemo(
    () => new Map(days.map((d) => [d.id, d.week_number])),
    [days],
  );

  // Realtime: live-push on any point_awards change.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("leaderboard-awards")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "point_awards" },
        (payload) => {
          setAwards((cur) => {
            if (payload.eventType === "INSERT") return [...cur, payload.new as PointAward];
            if (payload.eventType === "DELETE")
              return cur.filter((a) => a.id !== (payload.old as PointAward).id);
            if (payload.eventType === "UPDATE")
              return cur.map((a) =>
                a.id === (payload.new as PointAward).id ? (payload.new as PointAward) : a,
              );
            return cur;
          });
          setPulse(true);
          setTimeout(() => setPulse(false), 800);
        },
      )
      .subscribe();

    // Fallback poll every 60s in case the socket drops.
    const poll = setInterval(async () => {
      const { data } = await supabase.from("point_awards").select("*");
      if (data) setAwards(data as PointAward[]);
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  const rows = useMemo(
    () => computeRankings(students, awards, dayWeek, week, todayId),
    [students, awards, dayWeek, week, todayId],
  );

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3); // everyone below the podium

  // Climbers: rank movement from the end of the previous week to the current week.
  const currentWeek = useMemo(
    () => latestWeekWithAwards(awards, dayWeek),
    [awards, dayWeek],
  );
  const climbers = useMemo(
    () => computeClimbers(students, awards, dayWeek, currentWeek),
    [students, awards, dayWeek, currentWeek],
  );

  return (
    <main className={`min-h-screen bg-ink text-white ${display ? "p-6" : "p-4 sm:p-8"}`}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-4xl">
              FutureNYC<span className="text-accent">AI</span> Leaderboard
              {pulse && <span className="ml-3 align-middle text-base text-accent">● live</span>}
            </h1>
            <p className="text-sm text-slate-400">
              {mode === "climbers"
                ? `Biggest climbers into Week ${currentWeek}`
                : week === "all"
                  ? "All-time standings"
                  : `Week ${week} standings`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-white/5 p-1">
            {WEEKS.map((w) => (
              <button
                key={String(w)}
                onClick={() => {
                  setMode("rank");
                  setWeek(w);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  mode === "rank" && week === w ? "bg-accent text-navy" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {w === "all" ? "All-Time" : `Week ${w}`}
              </button>
            ))}
            <button
              onClick={() => setMode("climbers")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                mode === "climbers" ? "bg-accent text-navy" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              📈 Climbers
            </button>
          </div>
        </div>

        {mode === "rank" && (
        <>
        {/* Podium */}
        <div className="mb-8 grid grid-cols-3 items-end gap-3 sm:gap-6">
          {[1, 0, 2].map((idx) => {
            const p = podium[idx];
            if (!p) return <div key={idx} />;
            const heights = ["h-32", "h-44", "h-24"]; // 2nd, 1st, 3rd
            const order = idx === 0 ? 1 : idx === 1 ? 0 : 2; // visual order index
            return (
              <div key={p.student_id} className="flex flex-col items-center">
                <div className="mb-2 text-center">
                  <div className="text-3xl sm:text-5xl">{MEDAL[idx]}</div>
                  <div className="mt-1 max-w-[10rem] truncate text-sm font-semibold sm:text-lg">
                    {p.name}
                  </div>
                  <div className="text-xl font-extrabold text-accent sm:text-3xl">
                    {p.total}
                  </div>
                </div>
                <div
                  className={`w-full rounded-t-xl ${heights[order]} ${
                    idx === 0
                      ? "bg-accent"
                      : idx === 1
                        ? "bg-white/30"
                        : "bg-amber-700/60"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Ranks 4–10 */}
        {rest.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3 text-right">Today</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rest.map((r) => (
                  <tr key={r.student_id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-bold text-slate-300">#{r.rank}</td>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {r.today > 0 ? `+${r.today}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-accent">
                      {r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}

        {/* Climbers — biggest rank jumps vs. previous week */}
        {mode === "climbers" && (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {currentWeek < 2 ? (
              <p className="px-4 py-10 text-center text-slate-400">
                Climbers appear once Week 2 has points — there&apos;s no previous week to compare yet.
              </p>
            ) : climbers.length === 0 ? (
              <p className="px-4 py-10 text-center text-slate-400">
                No one has climbed in rank since last week yet.
              </p>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Climb</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3 text-right">Last wk</th>
                    <th className="px-4 py-3 text-right">Now</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {climbers.map((c) => (
                    <tr key={c.student_id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-bold text-emerald-400">▲ {c.delta}</td>
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-right text-slate-400">#{c.prevRank}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">#{c.currentRank}</td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-accent">{c.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!display && (
          <p className="mt-6 text-center text-xs text-slate-500">
            Tip: open <code className="text-slate-400">/leaderboard?display=true</code> for full-screen projector mode.
          </p>
        )}
      </div>
    </main>
  );
}
