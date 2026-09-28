"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

// Generate `count` unique 4-digit PINs not already used by any student.
async function generateUniquePins(
  supabase: ReturnType<typeof createClient>,
  count: number,
): Promise<string[]> {
  const { data } = await supabase.from("students").select("pin");
  const used = new Set<string>((data || []).map((s: { pin: string | null }) => s.pin).filter(Boolean) as string[]);
  const pins: string[] = [];
  while (pins.length < count) {
    const p = String(Math.floor(1000 + Math.random() * 9000));
    if (!used.has(p)) {
      used.add(p);
      pins.push(p);
    }
  }
  return pins;
}

export async function addStudent(
  name: string,
  nickname?: string,
  cohortYear?: number,
  gender?: string,
) {
  const { supabase } = await requireUser();

  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Name is required" };

  const finalNickname = nickname?.trim() || cleanName.split(/\s+/)[0];
  const [pin] = await generateUniquePins(supabase, 1);

  const { error } = await supabase.from("students").insert({
    name: cleanName,
    nickname: finalNickname || null,
    cohort_year: cohortYear || 2026,
    gender: gender || null,
    pin,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateStudent(
  id: string,
  name: string,
  nickname?: string,
  cohortYear?: number,
  gender?: string,
) {
  const { supabase } = await requireUser();

  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Name is required" };

  const finalNickname = nickname?.trim() || cleanName.split(/\s+/)[0];

  const { error } = await supabase
    .from("students")
    .update({
      name: cleanName,
      nickname: finalNickname || null,
      cohort_year: cohortYear || 2026,
      gender: gender || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteStudent(id: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function bulkImportStudents(
  students: { name: string; nickname?: string; cohortYear?: number }[],
  replaceMode: boolean,
) {
  const { supabase } = await requireUser();

  const sanitized = students
    .map((s) => {
      const cleanName = s.name.trim();
      const finalNickname = s.nickname?.trim() || cleanName.split(/\s+/)[0];
      return {
        name: cleanName,
        nickname: finalNickname || null,
        cohort_year: s.cohortYear || 2026,
      };
    })
    .filter((s) => s.name.length > 0);

  if (sanitized.length === 0) {
    return { ok: false, error: "No valid student names to import" };
  }

  if (replaceMode) {
    // Delete all existing students. Since students.id uses uuid, GT is safe.
    const { error: deleteErr } = await supabase
      .from("students")
      .delete()
      .gt("created_at", "1970-01-01T00:00:00Z");

    if (deleteErr) return { ok: false, error: `Failed to clear existing roster: ${deleteErr.message}` };
  }

  // Assign a unique PIN to each imported student (after any replace-delete so
  // the uniqueness check reflects the post-delete roster).
  const pins = await generateUniquePins(supabase, sanitized.length);
  const withPins = sanitized.map((s, i) => ({ ...s, pin: pins[i] }));

  const { error: insertErr } = await supabase.from("students").insert(withPins);

  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function updateStudentAttendance(
  attendanceId: string | null,
  studentId: string,
  dayId: string,
  status: AttendanceStatus,
  notes?: string,
  arrivalTime?: string,
) {
  const { supabase, user } = await requireUser();

  const payload: any = {
    student_id: studentId,
    day_id: dayId,
    status,
    notes: notes?.trim() || null,
    arrival_time: arrivalTime?.trim() || null,
    recorded_by: user.email,
  };

  if (attendanceId) {
    payload.id = attendanceId;
  }

  const { error } = await supabase.from("attendance").upsert(payload, {
    onConflict: "student_id,day_id",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  return { ok: true };
}

export async function updatePointAward(
  awardId: string,
  studentId: string,
  points: number,
  note?: string,
) {
  const { supabase } = await requireUser();

  // Retrieve award category to perform validation
  const { data: award, error: awardErr } = await supabase
    .from("point_awards")
    .select("category_id")
    .eq("id", awardId)
    .single();

  if (awardErr || !award) return { ok: false, error: "Point award not found" };

  const { data: cat, error: catErr } = await supabase
    .from("point_categories")
    .select("*")
    .eq("id", award.category_id)
    .single();

  if (catErr || !cat) return { ok: false, error: "Category not found" };

  let pointsAwarded = Math.trunc(points);

  if (cat.min_points !== null && pointsAwarded < cat.min_points)
    return { ok: false, error: `Minimum is ${cat.min_points} points` };
  if (cat.max_points !== null && pointsAwarded > cat.max_points)
    return { ok: false, error: `Maximum is ${cat.max_points} points` };
  if (cat.requires_note && !note?.trim())
    return { ok: false, error: "A note is required for this category" };

  const { error } = await supabase
    .from("point_awards")
    .update({
      points_awarded: pointsAwarded,
      note: note?.trim() || null,
    })
    .eq("id", awardId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function deletePointAward(awardId: string, studentId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("point_awards").delete().eq("id", awardId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: true };
}
