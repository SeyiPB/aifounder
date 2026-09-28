"use client";

import { useMemo, useState, useTransition } from "react";
import { awardPoints } from "./actions";
import type { PointAward, PointCategory, Student } from "@/lib/types";
import { DEMO_DAY_RUBRIC, RUBRIC_SCALE, isDemoDayCategory } from "@/lib/rubric";

export function AwardPanel({
  students,
  categories,
  dayNumber,
  dayId,
  todayAwards,
}: {
  students: Student[];
  categories: PointCategory[];
  dayNumber: number;
  dayId: string;
  todayAwards: PointAward[];
}) {
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [category, setCategory] = useState<PointCategory | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);
  const [pending, startTransition] = useTransition();

  // Day-gated categories (e.g. stand-up only Days 17–20).
  const visibleCategories = useMemo(
    () =>
      categories.filter((c) => {
        if (c.min_day_number !== null && dayNumber < c.min_day_number) return false;
        if (c.max_day_number !== null && dayNumber > c.max_day_number) return false;
        return true;
      }),
    [categories, dayNumber],
  );

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return students
      .filter((s) => (s.nickname || s.name).toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, students]);

  function pickCategory(c: PointCategory) {
    setCategory(c);
    setPoints(c.points);
    setConfirmDup(false);
  }

  function flash(t: { ok: boolean; msg: string }) {
    setToast(t);
    setTimeout(() => setToast(null), 2500);
  }

  // Has this student already been awarded this category today?
  const isDuplicate = useMemo(() => {
    if (!student || !category) return false;
    return todayAwards.some(
      (a) => a.student_id === student.id && a.category_id === category.id,
    );
  }, [student, category, todayAwards]);

  function submit() {
    if (!student || !category) return;
    if (category.requires_note && !note.trim()) {
      flash({ ok: false, msg: "A note is required for this category." });
      return;
    }
    // Duplicate warning: require a confirming second click.
    if (isDuplicate && !confirmDup) {
      setConfirmDup(true);
      return;
    }
    startTransition(async () => {
      const res = await awardPoints({
        studentId: student.id,
        dayId,
        categoryId: category.id,
        points,
        note,
      });
      if (res.ok) {
        flash({ ok: true, msg: `${category.icon} ${points >= 0 ? "+" : ""}${points} → ${student.nickname || student.name}` });
        // Reset for the next rapid award; keep nothing selected for speed.
        setStudent(null);
        setQuery("");
        setCategory(null);
        setPoints(0);
        setNote("");
        setConfirmDup(false);
      } else {
        flash({ ok: false, msg: res.error || "Failed" });
      }
    });
  }

  const manual = category?.requires_manual_points;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-navy">Award points</h2>

      {/* Student typeahead */}
      {student ? (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2">
          <span className="font-medium text-navy">{student.nickname || student.name}</span>
          <button
            onClick={() => setStudent(null)}
            className="text-sm text-slate-500 hover:text-rose-600"
          >
            change
          </button>
        </div>
      ) : (
        <div className="relative mb-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a student's name…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setStudent(s);
                      setQuery("");
                      setConfirmDup(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    {s.nickname || s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Category button grid */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {visibleCategories.map((c) => {
          const active = category?.id === c.id;
          return (
            <button
              key={c.id}
              onClick={() => pickCategory(c)}
              className={`flex items-start gap-2 rounded-lg border p-2 text-left text-xs transition ${
                active
                  ? "border-brand bg-brand/10 text-navy"
                  : "border-slate-200 hover:border-brand/50 hover:bg-slate-50"
              }`}
            >
              <span className="text-base leading-none">{c.icon}</span>
              <span>
                <span className="block font-medium">{c.name}</span>
                {!c.requires_manual_points && (
                  <span className="text-slate-400">+{c.points}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Manual points (Demo Day, Bonus, deductions) */}
      {category && (manual || true) && (
        <div className="mb-3 flex items-center gap-2">
          <label className="text-sm text-slate-600">Points</label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
          {category.min_points !== null && category.max_points !== null && (
            <span className="text-xs text-slate-400">
              range {category.min_points}–{category.max_points}
            </span>
          )}
        </div>
      )}

      {/* Demo Day rubric */}
      {category && isDemoDayCategory(category.name) && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="mb-1 font-semibold">🚀 Demo Day rubric — 6 dimensions × 0–5 (max 30)</p>
          <ul className="space-y-0.5">
            {DEMO_DAY_RUBRIC.map((d) => (
              <li key={d.name}>
                <span className="font-medium">{d.name}:</span> {d.measures}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-amber-700">{RUBRIC_SCALE}</p>
        </div>
      )}

      {/* Note */}
      {category && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            category.requires_note ? "Note (required)…" : "Note (optional)…"
          }
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      )}

      {/* Duplicate-award warning */}
      {isDuplicate && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠️ You&apos;ve already awarded {category?.icon} {category?.name} to{" "}
          {student?.nickname || student?.name} today.
          {confirmDup ? " Click again to confirm." : ""}
        </p>
      )}

      <button
        disabled={!student || !category || pending}
        onClick={submit}
        className={`w-full rounded-lg py-2.5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
          isDuplicate && confirmDup ? "bg-amber-600 hover:bg-amber-700" : "bg-navy hover:bg-navyhover"
        }`}
      >
        {pending
          ? "Awarding…"
          : isDuplicate && confirmDup
            ? "Confirm duplicate award"
            : "Award points"}
      </button>

      {toast && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {toast.msg}
        </p>
      )}
    </section>
  );
}
