"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { awardQuizPointsForSession } from "@/lib/quiz-scoring";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export type AnswerKeyQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: { id: string; label: string; isCorrect: boolean }[];
};

// Full answer key for a quiz: every question with its options and the correct
// one flagged. Facilitator-only (authenticated read).
export async function getQuizAnswerKey(
  quizId: string,
): Promise<{ ok: true; questions: AnswerKeyQuestion[] } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, position, prompt, quiz_options(id, label, position, is_correct)")
    .eq("quiz_id", quizId)
    .order("position");
  if (error) return { ok: false, error: error.message };

  const questions: AnswerKeyQuestion[] = (data || []).map((q: {
    id: string;
    position: number;
    prompt: string;
    quiz_options: { id: string; label: string; position: number; is_correct: boolean }[];
  }) => ({
    id: q.id,
    position: q.position,
    prompt: q.prompt,
    options: (q.quiz_options || [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, label: o.label, isCorrect: o.is_correct })),
  }));

  return { ok: true, questions };
}

// Toggle a quiz's completion status (Done / Upcoming).
export async function setQuizStatus(quizId: string, status: "upcoming" | "done") {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("quizzes")
    .update({ status })
    .eq("id", quizId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/quizzes");
  return { ok: true };
}

function genJoinCode() {
  // Unambiguous chars (no 0/O, 1/I) for projector readability.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Start (or reuse) a live session for a quiz. Returns the session id + code.
export async function startSession(quizId: string) {
  const { supabase, user } = await requireUser();

  // Reuse an existing non-ended session for this quiz if present.
  const { data: existing } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("quiz_id", quizId)
    .neq("status", "ended")
    .maybeSingle();

  if (existing) {
    revalidatePath("/quizzes");
    return { ok: true, sessionId: existing.id, joinCode: existing.join_code };
  }

  // Generate a unique join code.
  let joinCode = genJoinCode();
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabase
      .from("quiz_sessions")
      .select("id")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (!clash) break;
    joinCode = genJoinCode();
  }

  const { data, error } = await supabase
    .from("quiz_sessions")
    .insert({
      quiz_id: quizId,
      join_code: joinCode,
      status: "lobby",
      created_by: user.email,
    })
    .select("id, join_code")
    .single();

  if (error || !data) return { ok: false, error: error?.message || "Failed to start" };

  revalidatePath("/quizzes");
  return { ok: true, sessionId: data.id, joinCode: data.join_code };
}

// Move lobby → active and show the first question.
export async function beginQuiz(sessionId: string) {
  const { supabase } = await requireUser();

  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("quiz_id")
    .eq("id", sessionId)
    .single();
  if (!session) return { ok: false, error: "Session not found" };

  const { data: first } = await supabase
    .from("quiz_questions")
    .select("id")
    .eq("quiz_id", session.quiz_id)
    .order("position")
    .limit(1)
    .maybeSingle();

  if (!first) return { ok: false, error: "This quiz has no questions yet." };

  const { error } = await supabase
    .from("quiz_sessions")
    .update({
      status: "active",
      current_question_id: first.id,
      current_question_started_at: new Date().toISOString(),
      current_revealed: false,
    })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Reveal the correct answer + tally for the current question.
export async function revealCurrent(sessionId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("quiz_sessions")
    .update({ current_revealed: true })
    .eq("id", sessionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Advance to the next question, or end the session if none remain.
export async function nextQuestion(sessionId: string) {
  const { supabase } = await requireUser();

  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("quiz_id, current_question_id")
    .eq("id", sessionId)
    .single();
  if (!session) return { ok: false, error: "Session not found" };

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, position")
    .eq("quiz_id", session.quiz_id)
    .order("position");

  const list = questions || [];
  const idx = list.findIndex((q) => q.id === session.current_question_id);
  const next = list[idx + 1];

  if (!next) {
    return endSession(sessionId);
  }

  const { error } = await supabase
    .from("quiz_sessions")
    .update({
      current_question_id: next.id,
      current_question_started_at: new Date().toISOString(),
      current_revealed: false,
    })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// End the session and award leaderboard points (once per quiz per student).
export async function endSession(sessionId: string) {
  const { supabase, user } = await requireUser();

  const result = await awardQuizPointsForSession(supabase, sessionId, user.email || "facilitator");
  if (!result.ok) return result;

  const { error } = await supabase
    .from("quiz_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString(), current_revealed: true })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/quizzes");
  revalidatePath("/leaderboard");
  return { ok: true, awarded: result.awarded };
}

// Host console state: session, current question + options (with correctness),
// live answer tally, and joined participants. Polled by the host UI.
export async function getHostState(sessionId: string) {
  const { supabase } = await requireUser();

  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false as const, error: "Session not found" };

  const { data: participants } = await supabase
    .from("quiz_participants")
    .select("id, display_name, total_score")
    .eq("session_id", sessionId)
    .order("joined_at");

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, position, prompt, question_type")
    .eq("quiz_id", session.quiz_id)
    .order("position");

  const list = questions || [];
  const currentIndex = list.findIndex((q) => q.id === session.current_question_id);

  let currentQuestion = null;
  let tally: { optionId: string; label: string; isCorrect: boolean; count: number }[] = [];
  let answeredCount = 0;

  if (session.current_question_id) {
    const { data: q } = await supabase
      .from("quiz_questions")
      .select("id, prompt, question_type, time_limit_seconds")
      .eq("id", session.current_question_id)
      .single();
    const { data: options } = await supabase
      .from("quiz_options")
      .select("id, label, is_correct, position")
      .eq("question_id", session.current_question_id)
      .order("position");
    const { data: answers } = await supabase
      .from("quiz_answers")
      .select("option_id")
      .eq("session_id", sessionId)
      .eq("question_id", session.current_question_id);

    answeredCount = (answers || []).length;
    tally = (options || []).map((o) => ({
      optionId: o.id,
      label: o.label,
      isCorrect: o.is_correct,
      count: (answers || []).filter((a) => a.option_id === o.id).length,
    }));
    currentQuestion = q
      ? { id: q.id, prompt: q.prompt, type: q.question_type, timeLimit: q.time_limit_seconds }
      : null;
  }

  return {
    ok: true as const,
    status: session.status as "lobby" | "active" | "ended",
    joinCode: session.join_code,
    revealed: session.current_revealed,
    participants: participants || [],
    questionCount: list.length,
    currentIndex,
    currentQuestion,
    tally,
    answeredCount,
  };
}

// Cancel/close a session without awarding (e.g. started by mistake).
export async function cancelSession(sessionId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("quiz_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/quizzes");
  return { ok: true };
}
