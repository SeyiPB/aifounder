import { createClient } from "@/lib/supabase/server";
import { resolveCurrentDay } from "@/lib/program";
import type { ProgramDay } from "@/lib/types";
import { Leaderboard } from "./Leaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { display?: string };
}) {
  const supabase = createClient();

  const [{ data: students }, { data: days }, { data: awards }] =
    await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase.from("program_days").select("*").order("day_number"),
      supabase.from("point_awards").select("*"),
    ]);

  const allDays = (days || []) as ProgramDay[];
  const todayDay = resolveCurrentDay(allDays);

  return (
    <Leaderboard
      students={students || []}
      days={allDays}
      initialAwards={awards || []}
      todayId={todayDay?.id || null}
      display={searchParams.display === "true"}
    />
  );
}
