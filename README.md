# FutureNYC AI Summer Camp — Attendance & Points Tracker

Next.js 14 (App Router) + Supabase + Tailwind. Single-facilitator tool for
attendance, real-time points, a public leaderboard, and live quizzes.

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Supabase** — create a project, then run the migrations in the SQL Editor in
   order (or use the combined file):
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_quizzes.sql`
   - or `supabase/migrations/combined_setup.sql` (both in one paste)

3. **Create the facilitator user** in Supabase → Authentication → Users → "Add
   user" (email + password). Use the same email you put in
   `NEXT_PUBLIC_FACILITATOR_EMAIL`.

4. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY        # server-only, never NEXT_PUBLIC_
   NEXT_PUBLIC_FACILITATOR_EMAIL
   ```

5. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 → redirects to `/dashboard` → login.

## Deploy (Vercel)

- Import the repo, set the four env vars in Project Settings (mark the
  service-role key Production + Preview only).
- See `SECURITY.md` for the full hardening checklist.

## Status

- [x] Project scaffold, Supabase clients, auth + middleware, security headers
- [x] `/dashboard` — attendance grid + fast points award + today's activity
- [ ] `/attendance`, `/points`, `/leaderboard`, `/students`, `/reports`
- [ ] `/quizzes` (host) + `/play` (student join)
