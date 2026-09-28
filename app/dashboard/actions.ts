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

export async function setAttendance(
  studentId: string,
  dayId: string,
  status: AttendanceStatus,
) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("attendance").upsert(
    {
      student_id: studentId,
      day_id: dayId,
      status,
      recorded_by: user.email,
    },
    { onConflict: "student_id,day_id" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function awardPoints(input: {
  studentId: string;
  dayId: string;
  categoryId: string;
  points: number;
  note?: string;
}) {
  const { supabase, user } = await requireUser();

  // Server-side validation against the category's rules.
  const { data: cat, error: catErr } = await supabase
    .from("point_categories")
    .select("*")
    .eq("id", input.categoryId)
    .single();

  if (catErr || !cat) return { ok: false, error: "Category not found" };

  let points = Math.trunc(input.points);

  if (cat.min_points !== null && points < cat.min_points)
    return { ok: false, error: `Minimum is ${cat.min_points} points` };
  if (cat.max_points !== null && points > cat.max_points)
    return { ok: false, error: `Maximum is ${cat.max_points} points` };
  if (cat.requires_note && !input.note?.trim())
    return { ok: false, error: "A note is required for this category" };

  const { error } = await supabase.from("point_awards").insert({
    student_id: input.studentId,
    day_id: input.dayId,
    category_id: input.categoryId,
    points_awarded: points,
    note: input.note?.trim() || null,
    awarded_by: user.email,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: true };
}
