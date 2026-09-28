-- =============================================================================
-- Migration 0002: live (Kahoot-style) end-of-week quizzes
-- =============================================================================
-- Same engine as FutureNYC: the facilitator hosts on the projector, students
-- join at /play with the join code + their personal PIN, and the facilitator
-- advances question by question. Points = correct answers × points_per_correct,
-- awarded ONCE per (quiz, student) under "Quiz performance"; replays are
-- practice. Students never read quiz tables directly (service-role actions
-- only), so is_correct never leaves the server before a question is revealed.
--
-- AI Founder Lab runs one quiz per week (Weeks 1–3, on the Friday). Week 4 is
-- pitch practice + Demo Day, so no quiz.
-- =============================================================================

create table if not exists public.quizzes (
  id                   uuid primary key default gen_random_uuid(),
  day_id               uuid references public.program_days(id) on delete set null,
  title                text not null,
  description          text,
  points_per_correct   int  not null default 5,
  speed_bonus          bool not null default false,  -- kept for schema parity; unused
  streak_bonus_per_day int  not null default 0,      -- kept for schema parity; unused
  is_active            bool not null default true,
  status               text not null default 'upcoming' check (status in ('upcoming','done')),
  created_by           text,
  created_at           timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id                 uuid primary key default gen_random_uuid(),
  quiz_id            uuid not null references public.quizzes(id) on delete cascade,
  position           int  not null default 1,
  prompt             text not null,
  question_type      text not null default 'mc' check (question_type in ('mc','tf')),
  time_limit_seconds int  not null default 20,
  points_override    int,
  created_at         timestamptz not null default now(),
  unique (quiz_id, position)
);

create table if not exists public.quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  position    int  not null default 1,
  label       text not null,
  is_correct  bool not null default false,   -- NEVER exposed to student clients
  created_at  timestamptz not null default now(),
  unique (question_id, position)
);

create table if not exists public.quiz_sessions (
  id                          uuid primary key default gen_random_uuid(),
  quiz_id                     uuid not null references public.quizzes(id) on delete cascade,
  join_code                   text not null unique,
  status                      text not null default 'lobby' check (status in ('lobby','active','ended')),
  current_question_id         uuid references public.quiz_questions(id) on delete set null,
  current_question_started_at timestamptz,
  current_revealed            bool not null default false,
  created_by                  text,
  created_at                  timestamptz not null default now(),
  ended_at                    timestamptz
);

create table if not exists public.quiz_participants (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.quiz_sessions(id) on delete cascade,
  student_id   uuid references public.students(id) on delete set null,
  display_name text not null,
  total_score  int  not null default 0,
  joined_at    timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists public.quiz_answers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.quiz_sessions(id) on delete cascade,
  participant_id uuid not null references public.quiz_participants(id) on delete cascade,
  question_id    uuid not null references public.quiz_questions(id) on delete cascade,
  option_id      uuid references public.quiz_options(id) on delete set null,
  is_correct     bool not null default false,
  response_ms    int,
  points_earned  int  not null default 0,
  created_at     timestamptz not null default now(),
  unique (session_id, participant_id, question_id)
);

create table if not exists public.quiz_results (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  day_id          uuid references public.program_days(id) on delete set null,
  attempts        int  not null default 0,
  first_correct   int,
  best_correct    int  not null default 0,
  total_questions int  not null default 0,
  points_awarded  int  not null default 0,
  streak_at_award int  not null default 0,
  first_at        timestamptz,
  last_attempt_at timestamptz,
  unique (quiz_id, student_id)
);

create index if not exists idx_quiz_questions_quiz       on public.quiz_questions(quiz_id);
create index if not exists idx_quiz_options_question     on public.quiz_options(question_id);
create index if not exists idx_quiz_sessions_code        on public.quiz_sessions(join_code);
create index if not exists idx_quiz_participants_session on public.quiz_participants(session_id);
create index if not exists idx_quiz_answers_session      on public.quiz_answers(session_id);
create index if not exists idx_quiz_answers_participant  on public.quiz_answers(participant_id);
create index if not exists idx_quiz_results_student      on public.quiz_results(student_id);
create index if not exists idx_quiz_results_day          on public.quiz_results(day_id);

alter table public.quizzes           enable row level security;
alter table public.quiz_questions    enable row level security;
alter table public.quiz_options      enable row level security;
alter table public.quiz_sessions     enable row level security;
alter table public.quiz_participants enable row level security;
alter table public.quiz_answers      enable row level security;
alter table public.quiz_results      enable row level security;

create policy "auth all quizzes"           on public.quizzes           for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all quiz_questions"    on public.quiz_questions    for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all quiz_options"      on public.quiz_options      for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all quiz_sessions"     on public.quiz_sessions     for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all quiz_participants" on public.quiz_participants for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all quiz_answers"      on public.quiz_answers      for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all quiz_results"      on public.quiz_results      for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into public.point_categories
  (name, points, description, icon, requires_manual_points, requires_note, sort_order)
values
  ('Quiz performance', 0, 'Auto-awarded from the end-of-week live quiz.', '🧠', false, false, 180)
on conflict do nothing;

-- One quiz per week, attached to that week's Friday (Days 5, 10, 15).
insert into public.quizzes (day_id, title, description, points_per_correct, created_by)
select d.id, v.title, v.description, 5, 'seed'
from (values
  (5,  'Week 1 Quiz: AI + Founder Foundations', 'AI fluency, Claude, prompting, AI ethics, SPARK ideation.'),
  (10, 'Week 2 Quiz: Business Model + Customer', 'Business Model Canvas, ICP, lemonade-stand economics, prototyping.'),
  (15, 'Week 3 Quiz: Market, GTM + Money',       'Market research, TAM/SAM/SOM, marketing & sales, revenue/profit/pricing.')
) as v(day_number, title, description)
join public.program_days d on d.day_number = v.day_number
where not exists (select 1 from public.quizzes q where q.day_id = d.id);
