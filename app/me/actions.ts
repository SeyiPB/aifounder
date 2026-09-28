"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCurrentDay } from "@/lib/program";
import type { ProgramDay } from "@/lib/types";

// Student view — UNAUTHENTICATED. Every action validates the student's PIN and
// returns ONLY that student's data (plus their rank as a number; never other
// students' names or points).

async function resolveStudent(pin: string) {
  const clean = pin.trim();
  if (!/^[0-9]{4}$/.test(clean)) return { ok: false as const, error: "Enter your 4-digit PIN." };
  const supabase = createAdminClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, name, nickname, startup_name, one_liner")
    .eq("pin", clean)
    .maybeSingle();
  if (!student) return { ok: false as const, error: "PIN not recognized." };
  return { ok: true as const, supabase, student };
}

export type MyDashboard =
  | { ok: false; error: string }
  | {
      ok: true;
      name: string;
      firstName: string;
      startupName: string | null;
      oneLiner: string | null;
      total: number;
      thisWeek: number;
      currentWeek: number;
      rank: number;
      cohortSize: number;
      byCategory: { name: string; icon: string | null; points: number; count: number }[];
      recent: { date: string; category: string; icon: string | null; points: number; note: string | null }[];
      attendance: { present: number; late: number; absent: number; excused: number };
      quizzes: { title: string; correct: number; total: number; points: number }[];
      upcoming: { dayNumber: number; date: string; title: string; mode: string } | null;
    };

export async function getMyDashboard(pin: string): Promise<MyDashboard> {
  const res = await resolveStudent(pin);
  if (!res.ok) return res;
  const { supabase, student } = res;

  const [{ data: allAwards }, { data: days }, { data: cats }, { data: att }, { data: results }, { count }] =
    await Promise.all([
      supabase.from("point_awards").select("student_id, day_id, category_id, points_awarded, note, created_at"),
      supabase.from("program_days").select("*").order("day_number"),
      supabase.from("point_categories").select("id, name, icon"),
      supabase.from("attendance").select("status").eq("student_id", student.id),
      supabase
        .from("quiz_results")
        .select("first_correct, total_questions, points_awarded, quizzes(title)")
        .eq("student_id", student.id),
      supabase.from("students").select("id", { count: "exact", head: true }),
    ]);

  const dayList = (days || []) as ProgramDay[];
  const dayById = new Map(dayList.map((d) => [d.id, d]));
  const catById = new Map((cats || []).map((c: { id: string; name: string; icon: string | null }) => [c.id, c]));
  const current = resolveCurrentDay(dayList);
  const currentWeek = current?.week_number ?? 1;

  // Rank among all students by total points (standard competition ranking).
  const totals = new Map<string, number>();
  for (const a of allAwards || []) totals.set(a.student_id, (totals.get(a.student_id) || 0) + a.points_awarded);
  const myTotal = totals.get(student.id) || 0;
  const rank = 1 + [...totals.values()].filter((t) => t > myTotal).length;

  const mine = (allAwards || []).filter((a) => a.student_id === student.id);

  const cat = new Map<string, { name: string; icon: string | null; points: number; count: number }>();
  let thisWeek = 0;
  for (const a of mine) {
    const c = catById.get(a.category_id);
    const key = a.category_id;
    const row = cat.get(key) || { name: c?.name || "Other", icon: c?.icon || null, points: 0, count: 0 };
    row.points += a.points_awarded;
    row.count += 1;
    cat.set(key, row);
    if (dayById.get(a.day_id)?.week_number === currentWeek) thisWeek += a.points_awarded;
  }

  const attendance = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of att || []) attendance[r.status as keyof typeof attendance] += 1;

  const today = new Date().toISOString().slice(0, 10);
  const next = dayList.find((d) => d.date >= today) || null;

  return {
    ok: true,
    name: student.name,
    firstName: student.nickname || student.name.split(/\s+/)[0],
    startupName: student.startup_name,
    oneLiner: student.one_liner,
    total: myTotal,
    thisWeek,
    currentWeek,
    rank,
    cohortSize: count ?? 0,
    byCategory: [...cat.values()].sort((a, b) => b.points - a.points),
    recent: mine
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 15)
      .map((a) => ({
        date: dayById.get(a.day_id)?.date || a.created_at.slice(0, 10),
        category: catById.get(a.category_id)?.name || "Points",
        icon: catById.get(a.category_id)?.icon || null,
        points: a.points_awarded,
        note: a.note,
      })),
    attendance,
    quizzes: (results || []).map(
      (r: { first_correct: number | null; total_questions: number; points_awarded: number; quizzes: { title: string } | { title: string }[] | null }) => ({
        title: (Array.isArray(r.quizzes) ? r.quizzes[0]?.title : r.quizzes?.title) || "Quiz",
        correct: r.first_correct ?? 0,
        total: r.total_questions,
        points: r.points_awarded,
      }),
    ),
    upcoming: next ? { dayNumber: next.day_number, date: next.date, title: next.title, mode: next.mode } : null,
  };
}

export async function updateMyStartup(pin: string, startupName: string, oneLiner: string) {
  const res = await resolveStudent(pin);
  if (!res.ok) return res;
  const { error } = await res.supabase
    .from("students")
    .update({
      startup_name: startupName.trim().slice(0, 80) || null,
      one_liner: oneLiner.trim().slice(0, 200) || null,
    })
    .eq("id", res.student.id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
