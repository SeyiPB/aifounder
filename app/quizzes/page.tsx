import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { QuizManager } from "./QuizManager";
import type { ProgramDay, Quiz } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: quizzes }, { data: days }, { data: questions }, { data: sessions }] =
    await Promise.all([
      supabase.from("quizzes").select("*"),
      supabase.from("program_days").select("*").order("day_number"),
      supabase.from("quiz_questions").select("id, quiz_id"),
      supabase.from("quiz_sessions").select("*").neq("status", "ended"),
    ]);

  // Question counts per quiz.
  const counts = new Map<string, number>();
  (questions || []).forEach((q: { quiz_id: string }) => {
    counts.set(q.quiz_id, (counts.get(q.quiz_id) || 0) + 1);
  });

  // Active (non-ended) session per quiz, if any.
  const activeByQuiz = new Map<string, { id: string; join_code: string; status: string }>();
  (sessions || []).forEach((s: { id: string; quiz_id: string; join_code: string; status: string }) => {
    activeByQuiz.set(s.quiz_id, { id: s.id, join_code: s.join_code, status: s.status });
  });

  const dayMap = new Map((days || []).map((d: ProgramDay) => [d.id, d]));

  const quizList = ((quizzes || []) as Quiz[])
    .map((q) => ({
      quiz: q,
      day: q.day_id ? dayMap.get(q.day_id) || null : null,
      questionCount: counts.get(q.id) || 0,
      activeSession: activeByQuiz.get(q.id) || null,
    }))
    .sort((a, b) => (a.day?.day_number || 99) - (b.day?.day_number || 99));

  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <QuizManager quizzes={quizList} />
      </main>
    </>
  );
}
