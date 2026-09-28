# Security Checklist — FutureNYC Tracker (Vercel + Supabase)

This app is small (single facilitator, 25 students) but it stores student names
and is publicly projected. The threats that matter: leaking the service-role key,
unauthenticated writes, and the public leaderboard exposing more than intended.

## 1. Environment variables (the #1 risk)

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Safe to expose; shipped to browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Safe to expose. RLS is what protects data, not this key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **SERVER ONLY** | **Bypasses all RLS.** Never prefix with `NEXT_PUBLIC_`. Never import into a Client Component. Use only in Route Handlers / Server Actions / `lib/supabase/admin.ts`. |
| `NEXT_PUBLIC_FACILITATOR_EMAIL` | Public | Gates the login UI only — not a security boundary. |

- In Vercel, set these under **Project → Settings → Environment Variables**.
  Mark `SUPABASE_SERVICE_ROLE_KEY` for **Production + Preview** only; never log it.
- Add a build-time guard: any module importing the service-role key must start
  with `import 'server-only'` so a stray client import fails the build.
- Never commit `.env*`. `.gitignore` must list `.env*.local`.

## 2. Row Level Security (enforced in migration 0001)

- RLS is **enabled on every table**. Public read on leaderboard tables;
  authenticated-only read on `attendance` (it holds notes).
- All writes require `auth.role() = 'authenticated'`.
- ⚠️ Public read on `students` exposes student names to anyone with the URL.
  This is *required* for the leaderboard. If the camp wants stricter privacy,
  switch the leaderboard to display nicknames only and restrict `students` reads.
- The anon key alone can only read public data — it cannot write.

## 3. Auth

- Single facilitator via Supabase Auth (email + password or magic link).
- Middleware protects every route except `/leaderboard` and the login page.
  Redirect unauthenticated users hitting protected routes to `/login`.
- Enforce the facilitator email server-side too (compare against
  `NEXT_PUBLIC_FACILITATOR_EMAIL`), not just by hiding the login form.
- Use `@supabase/ssr` with httpOnly cookies — do **not** store the session in
  `localStorage` (XSS-readable).

## 4. Vercel-specific hardening

- **Security headers** via `next.config.js` headers() or `vercel.json`:
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` (or a CSP `frame-ancestors`), `Referrer-Policy`.
  Note: `/leaderboard?display=true` is meant to be embedded on a classroom
  screen — if you iframe it, relax `X-Frame-Options` for that route only.
- Add a Content-Security-Policy allowing only `self` + the Supabase URL.
- Server Actions / Route Handlers must re-check auth — never trust the client.
- Validate + clamp all writes server-side (e.g. Demo Day points within 0–30,
  deduction requires a note) regardless of client-side checks.

## 5. Live quizzes — student-facing attack surface (migration 0002)

Students join with no account, so this is the most exposed part of the app.
The rule: **student devices never touch Supabase directly.**

- All student actions (join by code, submit answer) go through **Server Actions /
  Route Handlers** that use the service-role key behind the server boundary.
  The anon key has **no** access to quiz tables (RLS is authenticated-only).
- **Never send `quiz_options.is_correct` to a student client.** The server
  returns option text only; correctness + points are computed server-side.
  Verify this in the network tab before go-live (the classic Kahoot-clone leak).
- Validate the join code server-side on every student request, and reject if the
  session `status` isn't `active` / the question isn't the current one.
- Enforce one answer per question server-side (`unique(session, participant,
  question)`) so a student can't resubmit after seeing the timer.
- Compute `response_ms` from `current_question_started_at` **on the server** —
  don't trust a client-supplied timestamp for speed bonuses.
- The join page (`/play` or similar) is the only public-write path: rate-limit it
  (e.g. per-IP) so a bored student can't flood participants.
- Don't expose internal UUIDs as the join handle; use the short `join_code`.

## 6. Data integrity

- Demo Day points clamped to `[min_points, max_points]` from `point_categories`.
- Deductions (`Code of Conduct`, `Bonus`) require a note — enforce in the
  Server Action, not only the form.
- Rate-limit nothing critical here, but debounce the leaderboard realtime
  refresh to avoid hammering on rapid awards.

## 6. Before go-live

- [ ] Service-role key confirmed absent from client bundle (`grep` the build).
- [ ] RLS verified: anon key cannot insert/update/delete (test with curl).
- [ ] `.env*.local` gitignored and not in history.
- [ ] Login required for `/dashboard`, `/attendance`, `/points`, `/students`, `/reports`.
- [ ] `/leaderboard` loads with no session.
- [ ] Security headers present (check with `curl -I`).
