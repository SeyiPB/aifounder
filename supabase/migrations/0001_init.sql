-- =============================================================================
-- AI Founder Lab — Attendance, Points & Demo Day Tracker
-- Migration 0001: core schema + RLS + seed data
-- =============================================================================
-- Carried over from the FutureNYC tracker, consolidated:
--   * status/category constraints use CHECK, not native enums (easier to evolve)
--   * point_categories carries behavior flags (manual entry, min/max, day gating)
--     so the frontend never hardcodes category names or day numbers
--   * RLS: authenticated-only on every table. Students have no accounts; the
--     /play (quiz), /me (student view) and /judge (judge scorecard) routes go
--     through Server Actions that validate a PIN / access code and then use the
--     service-role key.
--   * point_awards has NO unique constraint (multiple awards/student/day/category
--     are valid); attendance HAS one (one status per student per day)
-- New for AI Founder Lab:
--   * students.startup_name / one_liner (students edit these from /me)
--   * program_days.mode ('in_person' | 'virtual')
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.students (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  nickname     text,
  cohort_year  int  not null default 2026,
  gender       text check (gender in ('male','female','non-binary','other','prefer_not_to_say')),
  pin          text unique check (pin is null or pin ~ '^[0-9]{4}$'),
  startup_name text,
  one_liner    text,
  created_at   timestamptz not null default now()
);

create table if not exists public.program_days (
  id          uuid primary key default gen_random_uuid(),
  day_number  int  not null unique check (day_number between 1 and 20),
  date        date not null unique,
  week_number int  not null check (week_number between 1 and 4),
  title       text not null,
  theme       text,
  mode        text not null default 'virtual' check (mode in ('in_person','virtual')),
  created_at  timestamptz not null default now()
);

create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  day_id       uuid not null references public.program_days(id) on delete cascade,
  status       text not null default 'present'
                 check (status in ('present','absent','late','excused')),
  arrival_time time,
  notes        text,
  recorded_by  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (student_id, day_id)
);

create table if not exists public.point_categories (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  points                 int  not null default 0,   -- default fill; overridable
  description            text,
  icon                   text,
  is_active              bool not null default true,
  -- behavior flags (drive the UI generically)
  requires_manual_points bool not null default false, -- Bonus, deduction
  requires_note          bool not null default false, -- deductions, bonus, evidence
  min_points             int,
  max_points             int,
  min_day_number         int,                          -- e.g. pitch practice = 16
  max_day_number         int,
  sort_order             int  not null default 100,
  created_at             timestamptz not null default now()
);

create table if not exists public.point_awards (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  day_id         uuid not null references public.program_days(id) on delete cascade,
  category_id    uuid not null references public.point_categories(id) on delete restrict,
  points_awarded int  not null,        -- allows override + negatives (deductions)
  note           text,
  awarded_by     text,
  created_at     timestamptz not null default now()
);

create table if not exists public.leaderboard_snapshots (
  id          uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  rankings    jsonb not null default '[]'::jsonb
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_awards_student    on public.point_awards(student_id);
create index if not exists idx_awards_day        on public.point_awards(day_id);
create index if not exists idx_awards_category   on public.point_awards(category_id);
create index if not exists idx_attendance_day    on public.attendance(day_id);
create index if not exists idx_attendance_student on public.attendance(student_id);

-- -----------------------------------------------------------------------------
-- updated_at trigger for attendance
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Totals view
-- -----------------------------------------------------------------------------

create or replace view public.student_totals as
select
  s.id            as student_id,
  s.name,
  s.nickname,
  coalesce(sum(pa.points_awarded), 0) as total_points
from public.students s
left join public.point_awards pa on pa.student_id = s.id
group by s.id, s.name, s.nickname;

-- =============================================================================
-- Row Level Security — authenticated (facilitator) only, everywhere.
-- The service-role key bypasses RLS and must NEVER reach the browser.
-- =============================================================================

alter table public.students              enable row level security;
alter table public.program_days          enable row level security;
alter table public.attendance            enable row level security;
alter table public.point_categories      enable row level security;
alter table public.point_awards          enable row level security;
alter table public.leaderboard_snapshots enable row level security;

create policy "auth all students"     on public.students         for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all program_days" on public.program_days     for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all attendance"   on public.attendance       for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all categories"   on public.point_categories for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all awards"       on public.point_awards     for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all snapshots"    on public.leaderboard_snapshots for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime: the facilitator leaderboard subscribes to point_awards changes.
alter publication supabase_realtime add table public.point_awards;

-- =============================================================================
-- Seed data
-- =============================================================================

-- Program days: 4 weeks × Mon–Fri, 5:00–7:00 PM.
-- Mon Sep 28 – Fri Oct 23, 2026. ⚠️ In-person weekdays are an ASSUMPTION
-- (Tuesday + Friday at Civic Hall, so the Friday quiz and Demo Day are in the
-- room) — fix with: update program_days set mode = ... where day_number in (...).
do $$
declare
  v_start date := '2026-09-28';  -- first Monday of the program
begin
  insert into public.program_days (day_number, date, week_number, title, theme, mode)
  select d.n,
         v_start + ((d.n - 1) / 5) * 7 + ((d.n - 1) % 5),
         ((d.n - 1) / 5) + 1,
         d.title,
         d.theme,
         case when (d.n - 1) % 5 in (1, 4) then 'in_person' else 'virtual' end
  from (values
    (1,  'Kickoff, Ground Rules & AI Crash Course (Meet Claude)', 'Week 1: AI Fundamentals + Intro to Entrepreneurship'),
    (2,  'Team Building & Founder Strengths',                     'Week 1: AI Fundamentals + Intro to Entrepreneurship'),
    (3,  'Ideation with the SPARK Framework',                     'Week 1: AI Fundamentals + Intro to Entrepreneurship'),
    (4,  'Prompt Rewrite Lab + AI Ethics',                        'Week 1: AI Fundamentals + Intro to Entrepreneurship'),
    (5,  'Idea Sprint: 2–3 Ideas with Claude · Week 1 Quiz',      'Week 1: AI Fundamentals + Intro to Entrepreneurship'),
    (6,  'Business Model Canvas (Elements 1–6)',                  'Week 2: Business Model Canvas + ICP + Prototyping'),
    (7,  'Ideal Customer Profile',                                'Week 2: Business Model Canvas + ICP + Prototyping'),
    (8,  'Lemonade Stand Practice Round',                         'Week 2: Business Model Canvas + ICP + Prototyping'),
    (9,  'Intro to Prototyping',                                  'Week 2: Business Model Canvas + ICP + Prototyping'),
    (10, 'Canvas + ICP Workshop, Deck Outline · Week 2 Quiz',     'Week 2: Business Model Canvas + ICP + Prototyping'),
    (11, 'Market Research Methods',                               'Week 3: Go-To-Market + Market Sizing + Finance'),
    (12, 'Market Sizing: TAM / SAM / SOM',                        'Week 3: Go-To-Market + Market Sizing + Finance'),
    (13, 'Marketing & Sales Strategy',                            'Week 3: Go-To-Market + Market Sizing + Finance'),
    (14, 'Finance Basics: Revenue, Profit & Pricing',             'Week 3: Go-To-Market + Market Sizing + Finance'),
    (15, 'Projections + Deck Sections · Week 3 Quiz',             'Week 3: Go-To-Market + Market Sizing + Finance'),
    (16, 'Pitch Practice 1: Full Run-Through',                    'Week 4: Pitch Practice → Demo Day'),
    (17, 'Pitch Practice 2: Feedback & Tightening',               'Week 4: Pitch Practice → Demo Day'),
    (18, 'Pitch Practice 3: Q&A Drills',                          'Week 4: Pitch Practice → Demo Day'),
    (19, 'Dress Rehearsal',                                       'Week 4: Pitch Practice → Demo Day'),
    (20, 'Demo Day',                                              'Week 4: Pitch Practice → Demo Day')
  ) as d(n, title, theme)
  on conflict (day_number) do nothing;
end $$;

-- Point categories — weighted toward ideas, customer evidence and building.
-- (Quiz performance is added in 0002; Demo Day judging lives in 0004 and is
-- kept separate from the points leaderboard.)
insert into public.point_categories
  (name, points, description, icon, requires_manual_points, requires_note, min_points, max_points, min_day_number, max_day_number, sort_order)
values
  -- Everyday engagement
  ('Completed session deliverable',        5,  'Finished the work assigned in today''s session.',                                  '✅', false, false, null, null, null, null, 10),
  ('Sharp question or insight',            3,  'Asked a question or made a point that moved the room forward.',                     '💡', false, false, null, null, null, null, 20),
  ('Helped another founder',               5,  'Gave useful feedback or help to another participant (facilitator-verified).',      '🤝', false, false, null, null, null, null, 30),
  -- Ideas
  ('Idea of the Day',                      10, 'Facilitator pick for the most promising idea shared today.',                        '🌟', false, false, null, null, null, null, 40),
  ('Sharpest problem statement',           5,  'A specific, painful, clearly-worded problem for a named customer.',                '🎯', false, false, null, null, null, null, 50),
  ('Smart pivot (backed by evidence)',     10, 'Changed direction because of real evidence, and can explain why.',                  '🔄', false, true,  null, null, null, null, 60),
  -- Customer evidence & traction
  ('Talked to a real potential customer',  5,  'Interviewed someone in their ICP and shared what they learned. Once per person.',   '🗣️', false, true,  null, null, null, null, 70),
  ('Validation data collected',            10, 'Ran a survey / test and brought back 10+ real responses.',                         '📊', false, true,  null, null, null, null, 80),
  ('Waitlist or sign-ups',                 10, 'Real people signed up for the product (landing page, form, list).',                 '📝', false, true,  null, null, null, null, 90),
  ('First sale, pre-order or LOI',         20, 'Someone committed money or signed a letter of intent.',                            '💰', false, true,  null, null, null, null, 100),
  -- Building & AI
  ('Prototype milestone',                  15, 'Showed a working or clickable prototype of the solution.',                          '🛠️', false, false, null, null, null, null, 110),
  ('Claude power move',                    5,  'Creative, substantive use of Claude — shared the prompt/workflow with the class.',   '🤖', false, false, null, null, null, null, 120),
  ('Caught & verified a Claude error',     5,  'Spotted an AI mistake and checked it against a real source.',                       '🔍', false, false, null, null, null, null, 130),
  -- Pitch deck & pitching
  ('Deck milestone on time',               10, 'Deck sections due this week are complete (Wk2: Intro/Team/Problem/Solution; Wk3: Market/Business Model/GTM/Financials; Wk4: full deck).', '📑', false, false, null, null, 10, 16, 140),
  ('Delivered a practice pitch',           5,  'Pitched in a practice session.',                                                    '🎤', false, false, null, null, 16, 19, 150),
  ('Most improved pitch',                  10, 'Biggest improvement between practice pitches.',                                    '📈', false, false, null, null, 17, 19, 160),
  ('Pitched at Demo Day',                  10, 'Presented live at Demo Day.',                                                       '🚀', false, false, null, null, 20, 20, 170),
  -- Discretionary
  ('Bonus (facilitator discretion)',       0,  'Discretionary bonus points.',                                                      '⭐', true,  true,  null, null, null, null, 190),
  ('Code of Conduct deduction',            0,  'Negative adjustment; note required.',                                              '⚠️', true,  true,  null, 0,    null, null, 200)
on conflict do nothing;

-- Students are NOT seeded here (real names stay out of git). Run the
-- git-ignored supabase/seed_roster.local.sql after the migrations, or add
-- students in-app at /students.
