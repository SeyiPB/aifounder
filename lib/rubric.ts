// Demo Day capstone rubric — from the FutureNYC curriculum (Day 20).
// Six dimensions, each scored 0–5 (maximum 30 points).
export const DEMO_DAY_RUBRIC: { name: string; measures: string }[] = [
  { name: "AI Use — Substantive", measures: "Uses AI tools in meaningful, integrated ways — not just to generate a sentence." },
  { name: "Human Judgment — Visible", measures: "Specific decisions the presenter made that the AI didn't make for them." },
  { name: "Real Audience or Problem", measures: "A specific, named audience or problem the project is actually for." },
  { name: "Live Demo Quality", measures: "The demo works and shows the project clearly without excessive explanation." },
  { name: "Presentation Clarity", measures: "A first-time audience member can understand the project." },
  { name: "Reflection and Learning", measures: "Genuine insight about what they learned, what surprised them, what they'd change." },
];

export const RUBRIC_SCALE = "0 = not attempted · 3 = solid · 5 = exceptional";

// True when a category is the Demo Day capstone (manual 0–30 entry).
export function isDemoDayCategory(name: string): boolean {
  return name.toLowerCase().includes("demo day");
}
