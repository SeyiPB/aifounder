# AI Founder Lab — Attendance, Points & Demo Day Tracker

Next.js 14 (App Router) + Supabase + Tailwind. Forked from the FutureNYC
tracker and adapted for the 4-week AI Founder Lab (Sep 28 – Oct 23, 2026,
Mon–Fri 5–7 PM; in person at Civic Hall Mon/Tue in Week 1, Thu/Fri in Weeks 2–4).

## What's in it

| Route | Who | What |
| --- | --- | --- |
| `/dashboard`, `/attendance`, `/points`, `/students`, `/reports`, `/leaderboard` | Facilitator (login) | Attendance, fast point awards, roster + PINs, reports, leaderboard |
| `/quizzes` | Facilitator | Host the live, Kahoot-style end-of-week quiz (Weeks 1–3, Fridays) |
| `/play` | Students (PIN) | Join the live quiz with the on-screen code + their PIN |
| `/me` | Students (PIN) | Their own points, rank, breakdown, quiz scores, attendance, startup name/one-liner, Demo Day rubric |
| `/judging` | Facilitator / lead judge | Add judges + codes, live Demo Day results, CSV export |
| `/judge` | Judges (access code) | Phone scorecard: 8 criteria × 1–5, weighted to 100 |

Demo Day judging is separate from program points: the $5,000 winner is the
highest average judge score (ties → lead judge's score). The rubric lives in
`lib/rubric.ts`; point categories are seeded in `supabase/migrations/0001_init.sql`
and editable in-app on `/points`.

## Setup

1. `npm install`
2. Create a Supabase project and run, in the SQL Editor, in order:
   - `supabase/migrations/0001_init.sql` — schema, schedule, point categories
   - `supabase/migrations/0002_quizzes.sql` — quiz engine + 3 weekly quizzes
   - `supabase/migrations/0003_seed_quiz_questions.sql` — question banks
   - `supabase/migrations/0004_judging.sql` — judges + scorecards
   - `supabase/seed_roster.local.sql` — the participant roster + PINs
     (**git-ignored** — it holds minors' names; keep it off GitHub)
3. Create the facilitator user in Supabase → Authentication → Users.
4. Copy `.env.example` to `.env.local` and fill in the four values.
5. `npm run dev` → http://localhost:3000

## Editing quiz questions

Edit `scripts/quiz-bank.mjs` (correct answer first; order is shuffled), then:

```bash
node scripts/quiz-bank.mjs > supabase/migrations/0003_seed_quiz_questions.sql
```

and re-run that file in the SQL Editor (it replaces the weekly questions).

## Deploy (Vercel)

Import the repo, set the four env vars (service-role key: Production + Preview
only). See `SECURITY.md`.
