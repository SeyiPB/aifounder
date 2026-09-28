import { createClient } from "@/lib/supabase/server";
import { resolveCurrentDay } from "@/lib/program";
import { Nav } from "@/components/Nav";
import { DaySwitcher } from "./DaySwitcher";
import { AttendanceGrid } from "./AttendanceGrid";
import { AwardPanel } from "./AwardPanel";
import { TodayActivity } from "./TodayActivity";
import type { ProgramDay } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { day?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: students }, { data: days }, { data: categories }] =
    await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase.from("program_days").select("*").order("day_number"),
      supabase
        .from("point_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  const allDays = (days || []) as ProgramDay[];
  const selectedDay =
    allDays.find((d) => d.id === searchParams.day) ||
    resolveCurrentDay(allDays);

  if (!selectedDay) {
    return (
      <>
        <Nav email={user?.email} />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-slate-500">No program days found. Run the seed migration.</p>
        </main>
      </>
    );
  }

  const [{ data: attendance }, { data: todayAwards }] = await Promise.all([
    supabase.from("attendance").select("*").eq("day_id", selectedDay.id),
    supabase
      .from("point_awards")
      .select("*")
      .eq("day_id", selectedDay.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              {selectedDay.theme}
            </p>
            <h1 className="text-2xl font-bold text-navy">
              Day {selectedDay.day_number}: {selectedDay.title}
            </h1>
            <p className="text-sm text-slate-500">
              {new Date(selectedDay.date + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <DaySwitcher days={allDays} selectedId={selectedDay.id} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <AttendanceGrid
            key={selectedDay.id}
            students={students || []}
            attendance={attendance || []}
            dayId={selectedDay.id}
          />
          <div className="space-y-6">
            <AwardPanel
              students={students || []}
              categories={categories || []}
              dayNumber={selectedDay.day_number}
              dayId={selectedDay.id}
              todayAwards={todayAwards || []}
            />
            <TodayActivity
              awards={todayAwards || []}
              students={students || []}
              categories={categories || []}
            />
          </div>
        </div>
      </main>
    </>
  );
}
