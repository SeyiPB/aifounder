import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Admin client — service-role key. BYPASSES RLS. Server-only.
// Used exclusively for code-validated student quiz actions (no auth session).
// Never import this into a Client Component; `server-only` enforces that.
//
// Reused across invocations (per warm serverless instance) so we don't rebuild
// the client — and its keep-alive HTTP connections — on every quiz poll/submit.
let cached: SupabaseClient | null = null;

export function createAdminClient() {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return cached;
}
