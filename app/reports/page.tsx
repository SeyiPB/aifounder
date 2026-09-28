import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { ReportsView } from "./ReportsView";
import type {
  Attendance,
  PointAward,
  PointCategory,
  ProgramDay,
  Student,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: students },
    { data: days },
    { data: categories },
    { data: attendance },
    { data: awards },
  ] = await Promise.all([
    supabase.from("students").select("*").order("name"),
    supabase.from("program_days").select("*").order("day_number"),
    supabase.from("point_categories").select("*").order("sort_order"),
    supabase.from("attendance").select("*"),
    supabase.from("point_awards").select("*"),
  ]);

  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:px-0">
        <ReportsView
          students={(students || []) as Student[]}
          days={(days || []) as ProgramDay[]}
          categories={(categories || []) as PointCategory[]}
          attendance={(attendance || []) as Attendance[]}
          awards={(awards || []) as PointAward[]}
        />
      </main>
    </>
  );
}
