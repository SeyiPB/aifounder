import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCurrentDay } from "./program";
import type { ProgramDay } from "./types";

// On session end: tally each participant's correct answers, award leaderboard
// points ONCE per (quiz, student) for the first scored attempt, and track
// best/attempts for replays. Returns how many students were newly awarded.
export async function awardQuizPointsForSession(
  supabase: SupabaseClient,
  sessionId: string,
  awardedBy: string,
): Promise<{ ok: true; awarded: number } | { ok: false; error: string }> {
  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("id, quiz_id")
    .eq("id", sessionId)
    .single();
  if (!session) return { ok: false, error: "Session not found" };

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", session.quiz_id)
    .single();
  if (!quiz) return { ok: false, error: "Quiz not found" };

  // Award points to the day the quiz is actually PLAYED (today), not the quiz's
  // curriculum day — so hosting the "Day 1 Review" on Day 2 credits Day 2.
  // Falls back to the quiz's own day if today isn't a program day.
  const { data: days } = await supabase
    .from("program_days")
    .select("id, day_number, date, week_number, title, theme");
  const today = resolveCurrentDay((days || []) as ProgramDay[]);
  const dayId = (today?.id ?? (quiz.day_id as string | null)) as string | null;

  // Quiz performance category for the leaderboard award.
  const { data: cat } = await supabase
    .from("point_categories")
    .select("id")
    .eq("name", "Quiz performance")
    .maybeSingle();

  // Question count for the "X/Y correct" note.
  const { count: totalQuestions } = await supabase
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", session.quiz_id);

  // Participants in this session.
  const { data: participants } = await supabase
    .from("quiz_participants")
    .select("id, student_id")
    .eq("session_id", sessionId);

  let awarded = 0;

  for (const p of participants || []) {
    if (!p.student_id) continue;

    // Answers this session (with timing for the speed bonus).
    const { data: answers } = await supabase
      .from("quiz_answers")
      .select("is_correct, response_ms, question_id")
      .eq("session_id", sessionId)
      .eq("participant_id", p.id);
    const correct = (answers || []).filter(
      (a: { is_correct: boolean }) => a.is_correct,
    ).length;

    // Update participant running score.
    await supabase.from("quiz_participants").update({ total_score: correct }).eq("id", p.id);

    // Existing result row?
    const { data: existing } = await supabase
      .from("quiz_results")
      .select("*")
      .eq("quiz_id", session.quiz_id)
      .eq("student_id", p.student_id)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing && existing.points_awarded > 0) {
      // Replay/practice — update best + attempts, do NOT award again.
      await supabase
        .from("quiz_results")
        .update({
          attempts: existing.attempts + 1,
          best_correct: Math.max(existing.best_correct, correct),
          last_attempt_at: now,
        })
        .eq("id", existing.id);
      continue;
    }

    // First scored attempt — award once. Points = correct × per-correct value.
    const points = correct * (quiz.points_per_correct as number);

    if (cat && dayId && points > 0) {
      await supabase.from("point_awards").insert({
        student_id: p.student_id,
        day_id: dayId,
        category_id: cat.id,
        points_awarded: points,
        note: `Quiz: ${correct}/${totalQuestions ?? 0} correct`,
        awarded_by: awardedBy,
      });
    }

    await supabase.from("quiz_results").upsert(
      {
        ...(existing ? { id: existing.id } : {}),
        quiz_id: session.quiz_id,
        student_id: p.student_id,
        day_id: dayId,
        attempts: (existing?.attempts ?? 0) + 1,
        first_correct: correct,
        best_correct: Math.max(existing?.best_correct ?? 0, correct),
        total_questions: totalQuestions ?? 0,
        points_awarded: points,
        streak_at_award: 0,
        first_at: existing?.first_at ?? now,
        last_attempt_at: now,
      },
      { onConflict: "quiz_id,student_id" },
    );

    awarded += 1;
  }

  return { ok: true, awarded };
}
