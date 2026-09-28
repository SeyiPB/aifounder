import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { computeJudgingResults, type Judge, type Scorecard } from "@/lib/judging";
import { JudgingAdmin } from "./JudgingAdmin";

export const dynamic = "force-dynamic";

export default async function JudgingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: students }, { data: judges }, { data: cards }, { data: totals }] = await Promise.all([
    supabase.from("students").select("id, name, startup_name").order("name"),
    supabase.from("judges").select("id, name, is_lead, access_code").order("is_lead", { ascending: false }).order("created_at"),
    supabase.from("demo_day_scorecards").select("judge_id, student_id, scores, comment, updated_at"),
    supabase.from("student_totals").select("student_id, total_points"),
  ]);

  const results = computeJudgingResults(
    students || [],
    (judges || []) as Judge[],
    (cards || []) as Scorecard[],
  );
  const points = Object.fromEntries(
    (totals || []).map((t: { student_id: string; total_points: number }) => [t.student_id, t.total_points]),
  );

  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <JudgingAdmin judges={(judges || []) as Judge[]} results={results} points={points} />
      </main>
    </>
  );
}
