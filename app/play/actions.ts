"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// All student actions are UNAUTHENTICATED. They go through the admin client
// (service role) ONLY after validating the join code + PIN here. We never send
// quiz_options.is_correct to the student until the question is revealed.

function normCode(code: string) {
  return code.trim().toUpperCase();
}

async function resolveSessionAndStudent(code: string, pin: string) {
  const supabase = createAdminClient();

  // Session (by code, any status so ended sessions still show a final score)
  // and student (by PIN) are independent — fetch them concurrently.
  const [sessionRes, studentRes] = await Promise.all([
    supabase
      .from("quiz_sessions")
      .select("*")
      .eq("join_code", normCode(code))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id, name, nickname")
      .eq("pin", pin.trim())
      .maybeSingle(),
  ]);

  if (!sessionRes.data) return { ok: false as const, error: "Session not found." };
  if (!studentRes.data) return { ok: false as const, error: "Invalid PIN." };

  return {
    ok: true as const,
    supabase,
    session: sessionRes.data,
    student: studentRes.data,
  };
}

// Join a live session with a join code + personal PIN.
export async function joinSession(code: string, pin: string) {
  const res = await resolveSessionAndStudent(code, pin);
  if (!res.ok) return { ok: false as const, error: res.error };
  const { supabase, session, student } = res;

  if (session.status === "ended")
    return { ok: false as const, error: "This quiz has already ended." };

  const { data: participant, error } = await supabase
    .from("quiz_participants")
    .upsert(
      {
        session_id: session.id,
        student_id: student.id,
        display_name: student.name,
      },
      { onConflict: "session_id,student_id" },
    )
    .select("id, display_name")
    .single();

  if (error || !participant) return { ok: false as const, error: error?.message || "Join failed" };

  return {
    ok: true as const,
    participantId: participant.id,
    displayName: participant.display_name,
  };
}

// Submit an answer for the current question. Correctness is computed server-side.
export async function submitAnswer(
  code: string,
  pin: string,
  questionId: string,
  optionId: string,
) {
  const res = await resolveSessionAndStudent(code, pin);
  if (!res.ok) return { ok: false as const, error: res.error };
  const { supabase, session, student } = res;

  if (session.status !== "active") return { ok: false as const, error: "Quiz is not active." };
  if (session.current_question_id !== questionId)
    return { ok: false as const, error: "This question is no longer active." };
  if (session.current_revealed)
    return { ok: false as const, error: "Answers are closed for this question." };

  // Participant lookup and option validation are independent — run concurrently.
  const [participantRes, optionRes] = await Promise.all([
    supabase
      .from("quiz_participants")
      .select("id")
      .eq("session_id", session.id)
      .eq("student_id", student.id)
      .maybeSingle(),
    supabase
      .from("quiz_options")
      .select("id, is_correct, question_id")
      .eq("id", optionId)
      .maybeSingle(),
  ]);

  const participant = participantRes.data;
  const option = optionRes.data;
  if (!participant) return { ok: false as const, error: "You haven't joined this session." };
  if (!option || option.question_id !== questionId)
    return { ok: false as const, error: "Invalid option." };

  // Server-computed response time (never trust the client).
  const startedAt = session.current_question_started_at
    ? new Date(session.current_question_started_at).getTime()
    : Date.now();
  const responseMs = Math.max(0, Date.now() - startedAt);

  // One answer per question is enforced by unique(session, participant, question);
  // rely on that instead of a pre-check query. A conflict means already answered.
  const { error } = await supabase.from("quiz_answers").insert({
    session_id: session.id,
    participant_id: participant.id,
    question_id: questionId,
    option_id: optionId,
    is_correct: option.is_correct,
    response_ms: responseMs,
    points_earned: option.is_correct ? 1 : 0,
  });

  if (error) {
    // 23505 = unique_violation → they already answered this question.
    if ((error as { code?: string }).code === "23505")
      return { ok: false as const, error: "Already answered." };
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export type PlayState =
  | { ok: false; error: string }
  | {
      ok: true;
      status: "lobby" | "active" | "ended";
      displayName: string;
      lobbyCount: number;
      revealed: boolean;
      answered: boolean;
      myOptionId: string | null;
      question: { id: string; prompt: string; type: "mc" | "tf"; timeLimit: number } | null;
      options: { id: string; label: string; isCorrect?: boolean }[];
      finalCorrect: number;
      totalQuestions: number;
      pointsAwarded: number;
    };

// Poll the current play state for a student. Returns the current question with
// is_correct STRIPPED unless the question has been revealed.
export async function getPlayState(code: string, pin: string): Promise<PlayState> {
  const res = await resolveSessionAndStudent(code, pin);
  if (!res.ok) return { ok: false, error: res.error };
  const { supabase, session, student } = res;

  const out: Extract<PlayState, { ok: true }> = {
    ok: true,
    status: session.status,
    displayName: student.name,
    lobbyCount: 0,
    revealed: session.current_revealed,
    answered: false,
    myOptionId: null,
    question: null,
    options: [],
    finalCorrect: 0,
    totalQuestions: 0,
    pointsAwarded: 0,
  };

  if (session.status === "lobby") {
    // Participant (for display name) + lobby count, concurrently.
    const [pRes, cRes] = await Promise.all([
      supabase
        .from("quiz_participants")
        .select("display_name")
        .eq("session_id", session.id)
        .eq("student_id", student.id)
        .maybeSingle(),
      supabase
        .from("quiz_participants")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id),
    ]);
    out.displayName = pRes.data?.display_name || student.name;
    out.lobbyCount = cRes.count ?? 0;
    return out;
  }

  if (session.status === "ended") {
    const [pRes, rRes] = await Promise.all([
      supabase
        .from("quiz_participants")
        .select("display_name, total_score")
        .eq("session_id", session.id)
        .eq("student_id", student.id)
        .maybeSingle(),
      supabase
        .from("quiz_results")
        .select("best_correct, total_questions, points_awarded")
        .eq("quiz_id", session.quiz_id)
        .eq("student_id", student.id)
        .maybeSingle(),
    ]);
    out.displayName = pRes.data?.display_name || student.name;
    out.finalCorrect = rRes.data?.best_correct ?? pRes.data?.total_score ?? 0;
    out.totalQuestions = rRes.data?.total_questions ?? 0;
    out.pointsAwarded = rRes.data?.points_awarded ?? 0;
    return out;
  }

  // Active — current question with is_correct STRIPPED unless revealed.
  const qId = session.current_question_id;
  if (!qId) return out;

  // Two concurrent queries, each embedding a child table to avoid extra trips:
  //   participant + this student's answers, and the question + its options.
  const [pRes, qRes] = await Promise.all([
    supabase
      .from("quiz_participants")
      .select("display_name, quiz_answers(option_id, question_id)")
      .eq("session_id", session.id)
      .eq("student_id", student.id)
      .maybeSingle(),
    supabase
      .from("quiz_questions")
      .select("id, prompt, question_type, time_limit_seconds, quiz_options(id, label, position, is_correct)")
      .eq("id", qId)
      .maybeSingle(),
  ]);

  out.displayName = pRes.data?.display_name || student.name;

  const myAnswers = (pRes.data?.quiz_answers || []) as { option_id: string; question_id: string }[];
  const mine = myAnswers.find((a) => a.question_id === qId);
  out.myOptionId = mine?.option_id ?? null;
  out.answered = out.myOptionId !== null;

  const question = qRes.data as
    | { id: string; prompt: string; question_type: "mc" | "tf"; time_limit_seconds: number; quiz_options: { id: string; label: string; position: number; is_correct: boolean }[] }
    | null;

  out.question = question
    ? {
        id: question.id,
        prompt: question.prompt,
        type: question.question_type,
        timeLimit: question.time_limit_seconds,
      }
    : null;

  out.options = (question?.quiz_options || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((o) => ({
      id: o.id,
      label: o.label,
      ...(out.revealed ? { isCorrect: o.is_correct } : {}),
    }));

  return out;
}
