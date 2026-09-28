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

export async function bulkSetAttendance(
  dayId: string,
  updates: { studentId: string; status: AttendanceStatus }[],
) {
  const { supabase, user } = await requireUser();

  if (updates.length === 0) return { ok: true };

  const payloads = updates.map((u) => ({
    student_id: u.studentId,
    day_id: dayId,
    status: u.status,
    recorded_by: user.email,
  }));

  const { error } = await supabase.from("attendance").upsert(payloads, {
    onConflict: "student_id,day_id",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/students");
  return { ok: true };
}

export async function updateSingleAttendance(
  id: string | null,
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

  if (id) {
    payload.id = id;
  }

  const { error } = await supabase.from("attendance").upsert(payload, {
    onConflict: "student_id,day_id",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}
