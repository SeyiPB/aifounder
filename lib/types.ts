// Shared row shapes (hand-written; mirror the SQL migrations).

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type Gender = "male" | "female" | "non-binary" | "other" | "prefer_not_to_say";

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export interface Student {
  id: string;
  name: string;
  nickname: string | null;
  cohort_year: number;
  gender: Gender | null;
  pin: string | null;
  created_at: string;
}

export interface ProgramDay {
  id: string;
  day_number: number;
  date: string; // ISO date
  week_number: number;
  title: string;
  theme: string | null;
}

export interface Attendance {
  id: string;
  student_id: string;
  day_id: string;
  status: AttendanceStatus;
  arrival_time: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface PointCategory {
  id: string;
  name: string;
  points: number;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  requires_manual_points: boolean;
  requires_note: boolean;
  min_points: number | null;
  max_points: number | null;
  min_day_number: number | null;
  max_day_number: number | null;
  sort_order: number;
}

export interface PointAward {
  id: string;
  student_id: string;
  day_id: string;
  category_id: string;
  points_awarded: number;
  note: string | null;
  awarded_by: string | null;
  created_at: string;
}

// ---- Quizzes ----

export interface Quiz {
  id: string;
  day_id: string | null;
  title: string;
  description: string | null;
  points_per_correct: number;
  speed_bonus: boolean;
  streak_bonus_per_day: number;
  is_active: boolean;
  status: "upcoming" | "done";
  created_by: string | null;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  position: number;
  prompt: string;
  question_type: "mc" | "tf";
  time_limit_seconds: number;
  points_override: number | null;
}

export interface QuizOption {
  id: string;
  question_id: string;
  position: number;
  label: string;
  is_correct: boolean; // NEVER sent to student clients
}

export type SessionStatus = "lobby" | "active" | "ended";

export interface QuizSession {
  id: string;
  quiz_id: string;
  join_code: string;
  status: SessionStatus;
  current_question_id: string | null;
  current_question_started_at: string | null;
  current_revealed: boolean;
  created_by: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface QuizParticipant {
  id: string;
  session_id: string;
  student_id: string | null;
  display_name: string;
  total_score: number;
  joined_at: string;
}

// Student-facing question shape — is_correct stripped out.
export interface PlayOption {
  id: string;
  label: string;
}
