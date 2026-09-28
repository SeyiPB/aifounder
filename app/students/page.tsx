import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { StudentRoster } from "./StudentRoster";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: students }, { data: totals }, { data: attendance }] =
    await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase.from("student_totals").select("*"),
      supabase.from("attendance").select("student_id, status"),
    ]);

  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <StudentRoster
          initialStudents={students || []}
          initialTotals={totals || []}
          initialAttendance={attendance || []}
        />
      </main>
    </>
  );
}
