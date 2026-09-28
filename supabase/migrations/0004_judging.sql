-- =============================================================================
-- Migration 0004: Demo Day judging
-- =============================================================================
-- Judges score each founder on the rubric in lib/rubric.ts (8 criteria × 1–5,
-- weighted to 100). Judges have no accounts: each gets a 6-character access
-- code and scores at /judge on their phone; those Server Actions validate the
-- code and use the service-role key. The facilitator (lead judge) sees the
-- aggregated results at /judging.
--
-- Demo Day judging is SEPARATE from the points leaderboard — the $5,000 winner
-- is decided by the judges' scores alone. Ties go to the lead judge's score.
-- =============================================================================

create table if not exists public.judges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_lead     bool not null default false,
  access_code text not null unique check (access_code ~ '^[A-Z2-9]{6}$'),
  created_at  timestamptz not null default now()
);

-- Only one lead judge.
create unique index if not exists judges_one_lead on public.judges (is_lead) where is_lead;

create table if not exists public.demo_day_scorecards (
  id         uuid primary key default gen_random_uuid(),
  judge_id   uuid not null references public.judges(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  scores     jsonb not null default '{}'::jsonb,  -- { criterion_key: 1..5 }
  comment    text,
  updated_at timestamptz not null default now(),
  unique (judge_id, student_id)
);

create index if not exists idx_scorecards_student on public.demo_day_scorecards(student_id);

drop trigger if exists trg_scorecards_updated_at on public.demo_day_scorecards;
create trigger trg_scorecards_updated_at
  before update on public.demo_day_scorecards
  for each row execute function public.set_updated_at();

alter table public.judges              enable row level security;
alter table public.demo_day_scorecards enable row level security;

create policy "auth all judges"     on public.judges              for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all scorecards" on public.demo_day_scorecards for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Seed the lead judge (rename in-app). Code is random; see it at /judging.
insert into public.judges (name, is_lead, access_code)
select 'Lead Judge', true,
       (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
          from generate_series(1, 6))
where not exists (select 1 from public.judges where is_lead);
