import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { StudentDetailClient } from "./StudentDetailClient";
import Link from "next/link";
import type { Attendance, PointAward, ProgramDay, PointCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export type QuizReviewQuestion = {
  prompt: string;
  chosenLabel: string | null;
  correctLabel: string;
  correct: boolean;
};
export type QuizReview = {
  quizId: string;
  title: string;
  dayNumber: number | null;
  correctCount: number;
  total: number;
  questions: QuizReviewQuestion[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildQuizReview(supabase: any, studentId: string): Promise<QuizReview[]> {
  const { data: parts } = await supabase
    .from("quiz_participants")
    .select("id")
    .eq("student_id", studentId);
  const partIds = (parts || []).map((p: { id: string }) => p.id);
  if (partIds.length === 0) return [];

  const { data: answers } = await supabase
    .from("quiz_answers")
    .select("question_id, option_id, is_correct")
    .in("participant_id", partIds);
  if (!answers || answers.length === 0) return [];

  const qIds = [...new Set(answers.map((a: { question_id: string }) => a.question_id))];
  const [{ data: questions }, { data: options }] = await Promise.all([
    supabase.from("quiz_questions").select("id, prompt, quiz_id").in("id", qIds),
    supabase.from("quiz_options").select("id, question_id, label, is_correct").in("question_id", qIds),
  ]);

  const quizIds = [...new Set((questions || []).map((q: { quiz_id: string }) => q.quiz_id))];
  const [{ data: quizzes }, { data: days }] = await Promise.all([
    supabase.from("quizzes").select("id, title, day_id").in("id", quizIds),
    supabase.from("program_days").select("id, day_number"),
  ]);

  const optById = new Map<string, { label: string }>();
  const correctByQ = new Map<string, string>();
  (options || []).forEach((o: { id: string; question_id: string; label: string; is_correct: boolean }) => {
    optById.set(o.id, { label: o.label });
    if (o.is_correct) correctByQ.set(o.question_id, o.label);
  });
  const qById = new Map<string, { prompt: string; quiz_id: string }>();
  (questions || []).forEach((q: { id: string; prompt: string; quiz_id: string }) =>
    qById.set(q.id, { prompt: q.prompt, quiz_id: q.quiz_id }),
  );
  const dayByQuiz = new Map<string, number | null>();
  const titleByQuiz = new Map<string, string>();
  const dayNum = new Map<string, number>();
  (days || []).forEach((d: { id: string; day_number: number }) => dayNum.set(d.id, d.day_number));
  (quizzes || []).forEach((z: { id: string; title: string; day_id: string | null }) => {
    titleByQuiz.set(z.id, z.title);
    dayByQuiz.set(z.id, z.day_id ? dayNum.get(z.day_id) ?? null : null);
  });

  // Group answers by quiz (first answer per question wins if replayed).
  const seen = new Set<string>();
  const byQuiz = new Map<string, QuizReviewQuestion[]>();
  for (const a of answers as { question_id: string; option_id: string; is_correct: boolean }[]) {
    if (seen.has(a.question_id)) continue;
    seen.add(a.question_id);
    const q = qById.get(a.question_id);
    if (!q) continue;
    const list = byQuiz.get(q.quiz_id) || [];
    list.push({
      prompt: q.prompt,
      chosenLabel: optById.get(a.option_id)?.label ?? null,
      correctLabel: correctByQ.get(a.question_id) ?? "",
      correct: a.is_correct,
    });
    byQuiz.set(q.quiz_id, list);
  }

  const review: QuizReview[] = [];
  for (const [quizId, qs] of byQuiz.entries()) {
    review.push({
      quizId,
      title: titleByQuiz.get(quizId) || "Quiz",
      dayNumber: dayByQuiz.get(quizId) ?? null,
      correctCount: qs.filter((x) => x.correct).length,
      total: qs.length,
      questions: qs,
    });
  }
  review.sort((a, b) => (a.dayNumber ?? 0) - (b.dayNumber ?? 0));
  return review;
}

export default async function StudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: student, error: studentError },
    { data: attendance },
    { data: awards },
    { data: programDays },
    { data: categories },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("attendance").select("*").eq("student_id", params.id),
    supabase.from("point_awards").select("*").eq("student_id", params.id),
    supabase.from("program_days").select("*").order("day_number"),
    supabase.from("point_categories").select("*").order("sort_order"),
  ]);

  // Build this student's quiz review: per quiz, each question with their answer,
  // whether it was correct, and the correct answer.
  const quizReview = student ? await buildQuizReview(supabase, params.id) : [];

  if (studentError || !student) {
    return (
      <>
        <Nav email={user?.email} />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-navy">Student Not Found</h2>
            <p className="mt-2 text-slate-500">
              The student with the specified ID could not be found or has been deleted.
            </p>
            <Link
              href="/students"
              className="mt-4 inline-block rounded-lg bg-navy px-4 py-2 font-semibold text-white hover:bg-navyhover"
            >
              Back to Students
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <StudentDetailClient
          student={student}
          attendanceRecords={(attendance || []) as Attendance[]}
          awardsRecords={(awards || []) as PointAward[]}
          programDays={(programDays || []) as ProgramDay[]}
          categories={(categories || []) as PointCategory[]}
          quizReview={quizReview}
        />
      </main>
    </>
  );
}
