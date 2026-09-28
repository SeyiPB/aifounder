"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { genAccessCode } from "@/lib/judging";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

async function uniqueCode(supabase: ReturnType<typeof createClient>) {
  for (let i = 0; i < 10; i++) {
    const code = genAccessCode();
    const { data } = await supabase.from("judges").select("id").eq("access_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate a unique code");
}

export async function addJudge(name: string) {
  const { supabase } = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Name is required" };
  const { error } = await supabase
    .from("judges")
    .insert({ name: clean, access_code: await uniqueCode(supabase) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/judging");
  return { ok: true };
}

export async function renameJudge(id: string, name: string) {
  const { supabase } = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Name is required" };
  const { error } = await supabase.from("judges").update({ name: clean }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/judging");
  return { ok: true };
}

export async function regenerateJudgeCode(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("judges")
    .update({ access_code: await uniqueCode(supabase) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/judging");
  return { ok: true };
}

// Deleting a judge also deletes their scorecards (FK cascade).
export async function deleteJudge(id: string) {
  const { supabase } = await requireUser();
  const { data: judge } = await supabase.from("judges").select("is_lead").eq("id", id).maybeSingle();
  if (judge?.is_lead) return { ok: false, error: "The lead judge can't be removed." };
  const { error } = await supabase.from("judges").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/judging");
  return { ok: true };
}
