// AI Founder Lab — Demo Day judging rubric.
//
// Eight criteria, each scored 1–5 by every judge. A criterion's weight is the
// share of 100 it's worth: weighted = score / 5 × weight, so a perfect
// scorecard is 100. Criteria mirror the required pitch deck sections.
//
// The final ranking is the average weighted score across judges. Ties are
// broken by the lead judge's score (see lib/judging.ts).

export interface RubricCriterion {
  key: string; // stable id stored in demo_day_scorecards.scores
  name: string;
  weight: number;
  question: string; // what the judge is asking themselves
  anchors: { 1: string; 3: string; 5: string };
}

export const DEMO_DAY_RUBRIC: RubricCriterion[] = [
  {
    key: "problem",
    name: "Problem & Customer",
    weight: 15,
    question: "Is this a real, specific, painful problem for a clearly defined customer?",
    anchors: {
      1: "Vague problem; customer is \"everyone.\"",
      3: "Clear problem and ICP, mostly from the founder's own assumptions.",
      5: "Sharp problem for a named ICP, backed by real customer conversations or data.",
    },
  },
  {
    key: "solution",
    name: "Solution & Prototype",
    weight: 20,
    question: "Does the solution clearly solve the problem, and did we see it work?",
    anchors: {
      1: "Solution unclear or disconnected from the problem; nothing to show.",
      3: "Solution fits the problem; mockup or partial prototype shown.",
      5: "Working prototype demoed live; the value is obvious in seconds.",
    },
  },
  {
    key: "market",
    name: "Market Opportunity",
    weight: 10,
    question: "Do they understand how big the opportunity is and who else is competing?",
    anchors: {
      1: "No sizing, or \"1% of a huge market\"; no competitors named.",
      3: "TAM/SAM/SOM present; competitors listed.",
      5: "Credible bottom-up TAM/SAM/SOM with stated assumptions; a clear reason they beat alternatives.",
    },
  },
  {
    key: "business_model",
    name: "Business Model & Financials",
    weight: 15,
    question: "Is it clear how this makes money, and do the numbers hold up?",
    anchors: {
      1: "No clear revenue model or pricing.",
      3: "Revenue model and price stated; rough projections.",
      5: "Pricing justified by customer value and costs; realistic projections with revenue, costs and profit.",
    },
  },
  {
    key: "gtm",
    name: "Go-to-Market & Traction",
    weight: 10,
    question: "Do they have a specific plan to win their first customers — and any proof it works?",
    anchors: {
      1: "\"We'll go viral\" / no plan.",
      3: "Specific channels to reach the ICP.",
      5: "Concrete first-100-customers plan plus real traction (sign-ups, sales, pre-orders, LOIs).",
    },
  },
  {
    key: "ai",
    name: "AI Leverage & Founder Judgment",
    weight: 10,
    question: "Did they use Claude substantively — and can we see the decisions they made themselves?",
    anchors: {
      1: "AI not used, or used only to write text they can't explain.",
      3: "Claude used for research/drafting; some of their own choices visible.",
      5: "Claude woven into research, building and iteration; founder clearly explains what they kept, changed and why.",
    },
  },
  {
    key: "delivery",
    name: "Pitch Delivery & Deck",
    weight: 15,
    question: "Was the pitch clear, compelling and complete?",
    anchors: {
      1: "Hard to follow; sections missing; over time.",
      3: "Clear story, all required sections, reasonable pacing.",
      5: "Confident, memorable story; clean deck; on time; strong close and call to action.",
    },
  },
  {
    key: "qa",
    name: "Q&A",
    weight: 5,
    question: "How well did they handle judges' questions?",
    anchors: {
      1: "Couldn't answer or deflected.",
      3: "Answered most questions reasonably.",
      5: "Crisp, honest answers — knows their numbers and admits what they don't know yet.",
    },
  },
];

export const RUBRIC_SCALE = "1 = missing · 2 = weak · 3 = solid · 4 = strong · 5 = investor-ready";

export const RUBRIC_MAX = DEMO_DAY_RUBRIC.reduce((s, c) => s + c.weight, 0); // 100

export type Scores = Record<string, number>;

// Weighted total out of 100. Unscored criteria count as 0, so only compare
// complete scorecards (see isComplete).
export function weightedTotal(scores: Scores): number {
  const total = DEMO_DAY_RUBRIC.reduce((sum, c) => {
    const s = scores[c.key];
    return sum + (typeof s === "number" ? (s / 5) * c.weight : 0);
  }, 0);
  return Math.round(total * 10) / 10;
}

export function isComplete(scores: Scores): boolean {
  return DEMO_DAY_RUBRIC.every((c) => {
    const s = scores[c.key];
    return Number.isInteger(s) && s >= 1 && s <= 5;
  });
}

// Keep only known criteria with integer scores 1–5 (server-side validation).
export function sanitizeScores(input: unknown): Scores {
  const out: Scores = {};
  if (!input || typeof input !== "object") return out;
  for (const c of DEMO_DAY_RUBRIC) {
    const v = (input as Record<string, unknown>)[c.key];
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) out[c.key] = v;
  }
  return out;
}
