import type { PointAward, ProgramDay, Student } from "./types";

export interface RankRow {
  student_id: string;
  name: string;
  total: number;
  today: number;
  rank: number;
}

// Compute rankings for a given week filter ("all" | 1 | 2 | 3 | 4).
// `todayId` scopes the "points today" column. Ties share a rank (standard
// competition ranking: 1, 2, 2, 4).
export function computeRankings(
  students: Student[],
  awards: PointAward[],
  dayWeek: Map<string, number>, // day_id -> week_number
  weekFilter: "all" | number,
  todayId: string | null,
): RankRow[] {
  const totals = new Map<string, number>();
  const today = new Map<string, number>();

  for (const s of students) {
    totals.set(s.id, 0);
    today.set(s.id, 0);
  }

  for (const a of awards) {
    if (!totals.has(a.student_id)) continue;
    const wk = dayWeek.get(a.day_id);
    if (weekFilter !== "all" && wk !== weekFilter) continue;
    totals.set(a.student_id, (totals.get(a.student_id) || 0) + a.points_awarded);
    if (todayId && a.day_id === todayId) {
      today.set(a.student_id, (today.get(a.student_id) || 0) + a.points_awarded);
    }
  }

  const rows = students
    .map((s) => ({
      student_id: s.id,
      name: s.name,
      total: totals.get(s.id) || 0,
      today: today.get(s.id) || 0,
      rank: 0,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  let lastTotal: number | null = null;
  let lastRank = 0;
  rows.forEach((r, i) => {
    if (r.total !== lastTotal) {
      lastRank = i + 1;
      lastTotal = r.total;
    }
    r.rank = lastRank;
  });

  return rows;
}

export interface Climber {
  student_id: string;
  name: string;
  currentRank: number;
  prevRank: number;
  delta: number; // positions climbed since end of previous week (positive = up)
  total: number; // cumulative points through the current week
}

// Cumulative ranking through week `maxWeek` (points from weeks 1..maxWeek).
// Returns a rank per student (standard competition ranking) and their total.
function cumulativeRanks(
  students: Student[],
  awards: PointAward[],
  dayWeek: Map<string, number>,
  maxWeek: number,
) {
  const totals = new Map<string, number>();
  students.forEach((s) => totals.set(s.id, 0));
  for (const a of awards) {
    const wk = dayWeek.get(a.day_id);
    if (wk == null || wk > maxWeek) continue;
    if (!totals.has(a.student_id)) continue;
    totals.set(a.student_id, (totals.get(a.student_id) || 0) + a.points_awarded);
  }
  const ordered = students
    .map((s) => ({ id: s.id, total: totals.get(s.id) || 0 }))
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
  const rankMap = new Map<string, number>();
  let lastTotal: number | null = null;
  let lastRank = 0;
  ordered.forEach((r, i) => {
    if (r.total !== lastTotal) {
      lastRank = i + 1;
      lastTotal = r.total;
    }
    rankMap.set(r.id, lastRank);
  });
  return { rankMap, totals };
}

// Students who climbed in rank from the end of the previous week to now.
// `currentWeek` is the week whose points we compare against the prior week.
// Returns only climbers (delta > 0), biggest jump first.
export function computeClimbers(
  students: Student[],
  awards: PointAward[],
  dayWeek: Map<string, number>,
  currentWeek: number,
): Climber[] {
  if (currentWeek < 2) return []; // need a previous week to compare against
  const cur = cumulativeRanks(students, awards, dayWeek, currentWeek);
  const prev = cumulativeRanks(students, awards, dayWeek, currentWeek - 1);

  const climbers: Climber[] = [];
  for (const s of students) {
    const currentRank = cur.rankMap.get(s.id) ?? 0;
    const prevRank = prev.rankMap.get(s.id) ?? 0;
    const delta = prevRank - currentRank;
    if (delta > 0) {
      climbers.push({
        student_id: s.id,
        name: s.name,
        currentRank,
        prevRank,
        delta,
        total: cur.totals.get(s.id) || 0,
      });
    }
  }
  climbers.sort((a, b) => b.delta - a.delta || a.currentRank - b.currentRank);
  return climbers;
}

// The latest week that has any awarded points (0 if none yet).
export function latestWeekWithAwards(
  awards: PointAward[],
  dayWeek: Map<string, number>,
): number {
  let max = 0;
  for (const a of awards) {
    const wk = dayWeek.get(a.day_id);
    if (wk != null && wk > max) max = wk;
  }
  return max;
}
