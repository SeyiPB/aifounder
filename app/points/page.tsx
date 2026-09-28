import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { PointsManagement } from "./PointsManagement";
import type { Student, PointCategory, ProgramDay, PointAward } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PointsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: students },
    { data: categories },
    { data: days },
    { data: awards },
  ] = await Promise.all([
    supabase.from("students").select("*").order("name"),
    supabase.from("point_categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("program_days").select("*").order("day_number"),
    supabase.from("point_awards").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PointsManagement
          initialStudents={(students || []) as Student[]}
          initialCategories={(categories || []) as PointCategory[]}
          initialDays={(days || []) as ProgramDay[]}
          initialAwards={(awards || []) as PointAward[]}
        />
      </main>
    </>
  );
}
