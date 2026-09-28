import type { ProgramDay } from "./types";

// Pick the program day to show: today's day if it's a program day,
// otherwise the most recent past program day, otherwise the first day.
export function resolveCurrentDay(days: ProgramDay[]): ProgramDay | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.day_number - b.day_number);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const exact = sorted.find((d) => d.date === todayStr);
  if (exact) return exact;

  const past = sorted.filter((d) => d.date <= todayStr);
  if (past.length > 0) return past[past.length - 1];

  return sorted[0];
}
