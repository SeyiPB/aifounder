import { DEMO_DAY_RUBRIC, isComplete, weightedTotal, type Scores } from "./rubric";

export interface Judge {
  id: string;
  name: string;
  is_lead: boolean;
  access_code: string;
}

export interface Scorecard {
  judge_id: string;
  student_id: string;
  scores: Scores;
  comment: string | null;
  updated_at: string;
}

export interface JudgingRow {
  student_id: string;
  name: string;
  startup_name: string | null;
  average: number | null; // mean weighted score across COMPLETE scorecards
  leadScore: number | null; // tiebreaker
  completeCount: number;
  byJudge: Record<string, number | null>; // judge_id -> weighted total (complete only)
  criterionAvg: Record<string, number | null>; // criterion key -> mean 1–5
  comments: { judge: string; comment: string }[];
  rank: number;
}

// Rank founders by average weighted score across judges' complete scorecards.
// Ties are broken by the lead judge's score; founders with no complete
// scorecards sort last and share the final rank.
export function computeJudgingResults(
  students: { id: string; name: string; startup_name: string | null }[],
  judges: Judge[],
  scorecards: Scorecard[],
): JudgingRow[] {
  const lead = judges.find((j) => j.is_lead);
  const judgeName = new Map(judges.map((j) => [j.id, j.name]));

  const rows: JudgingRow[] = students.map((s) => {
    const cards = scorecards.filter((c) => c.student_id === s.id && judgeName.has(c.judge_id));
    const complete = cards.filter((c) => isComplete(c.scores));

    const byJudge: Record<string, number | null> = {};
    for (const j of judges) {
      const card = complete.find((c) => c.judge_id === j.id);
      byJudge[j.id] = card ? weightedTotal(card.scores) : null;
    }

    const totals = complete.map((c) => weightedTotal(c.scores));
    const average = totals.length
      ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10
      : null;

    const criterionAvg: Record<string, number | null> = {};
    for (const c of DEMO_DAY_RUBRIC) {
      const vals = complete.map((card) => card.scores[c.key]);
      criterionAvg[c.key] = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : null;
    }

    return {
      student_id: s.id,
      name: s.name,
      startup_name: s.startup_name,
      average,
      leadScore: lead ? byJudge[lead.id] ?? null : null,
      completeCount: complete.length,
      byJudge,
      criterionAvg,
      comments: cards
        .filter((c) => c.comment && c.comment.trim())
        .map((c) => ({ judge: judgeName.get(c.judge_id) || "Judge", comment: c.comment!.trim() })),
      rank: 0,
    };
  });

  const key = (r: JudgingRow) => [r.average ?? -1, r.leadScore ?? -1] as const;
  rows.sort((a, b) => {
    const [aa, al] = key(a);
    const [ba, bl] = key(b);
    return ba - aa || bl - al || a.name.localeCompare(b.name);
  });

  // Standard competition ranking on (average, leadScore).
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const same = prev && key(prev)[0] === key(r)[0] && key(prev)[1] === key(r)[1];
    r.rank = same ? prev.rank : i + 1;
  });

  return rows;
}

export function genAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
