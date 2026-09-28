import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { AttendanceManagement } from "./AttendanceManagement";
import type { Attendance, ProgramDay, Student } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: students }, { data: days }, { data: attendance }] =
    await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase.from("program_days").select("*").order("day_number"),
      supabase.from("attendance").select("*"),
    ]);

  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <AttendanceManagement
          initialStudents={(students || []) as Student[]}
          initialDays={(days || []) as ProgramDay[]}
          initialAttendance={(attendance || []) as Attendance[]}
        />
      </main>
    </>
  );
}
