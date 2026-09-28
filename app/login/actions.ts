"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectTo = String(formData.get("redirect") || "/dashboard");

  // Enforce the single facilitator server-side, not just by hiding the form.
  const allowed = process.env.NEXT_PUBLIC_FACILITATOR_EMAIL?.toLowerCase();
  if (allowed && email.toLowerCase() !== allowed) {
    redirect("/login?error=" + encodeURIComponent("This email is not authorized."));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect(redirectTo);
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
