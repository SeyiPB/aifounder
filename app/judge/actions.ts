"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeScores, type Scores } from "@/lib/rubric";

// Judges are UNAUTHENTICATED. Every action validates the judge's access code
// first, then uses the admin (service-role) client scoped to that judge.

async function resolveJudge(code: string) {
  const supabase = createAdminClient();
  const { data: judge } = await supabase
    .from("judges")
    .select("id, name, is_lead")
    .eq("access_code", code.trim().toUpperCase())
    .maybeSingle();
  if (!judge) return { ok: false as const, error: "Invalid judge code." };
  return { ok: true as const, supabase, judge };
}

export type JudgeState =
  | { ok: false; error: string }
  | {
      ok: true;
      judgeName: string;
      isLead: boolean;
      founders: {
        id: string;
        name: string;
        startupName: string | null;
        oneLiner: string | null;
        scores: Scores;
        comment: string;
      }[];
    };

export async function getJudgeState(code: string): Promise<JudgeState> {
  const res = await resolveJudge(code);
  if (!res.ok) return res;
  const { supabase, judge } = res;

  const [{ data: students }, { data: cards }] = await Promise.all([
    supabase.from("students").select("id, name, startup_name, one_liner").order("name"),
    supabase
      .from("demo_day_scorecards")
      .select("student_id, scores, comment")
      .eq("judge_id", judge.id),
  ]);

  const byStudent = new Map(
    (cards || []).map((c: { student_id: string; scores: Scores; comment: string | null }) => [c.student_id, c]),
  );

  return {
    ok: true,
    judgeName: judge.name,
    isLead: judge.is_lead,
    founders: (students || []).map(
      (s: { id: string; name: string; startup_name: string | null; one_liner: string | null }) => ({
        id: s.id,
        name: s.name,
        startupName: s.startup_name,
        oneLiner: s.one_liner,
        scores: byStudent.get(s.id)?.scores || {},
        comment: byStudent.get(s.id)?.comment || "",
      }),
    ),
  };
}

export async function saveScorecard(
  code: string,
  studentId: string,
  scores: Scores,
  comment: string,
) {
  const res = await resolveJudge(code);
  if (!res.ok) return res;
  const { supabase, judge } = res;

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false as const, error: "Founder not found." };

  const { error } = await supabase.from("demo_day_scorecards").upsert(
    {
      judge_id: judge.id,
      student_id: studentId,
      scores: sanitizeScores(scores),
      comment: comment.trim().slice(0, 2000) || null,
    },
    { onConflict: "judge_id,student_id" },
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
