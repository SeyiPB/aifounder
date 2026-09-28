// End-of-week quiz bank for AI Founder Lab.
//
// Edit questions here, then regenerate the seed SQL:
//   node scripts/quiz-bank.mjs > supabase/migrations/0003_seed_quiz_questions.sql
//
// Write the CORRECT answer first in each `options` list — the generator
// shuffles option order (deterministically) so the answer isn't always "A".
// For true/false, list the correct one first too; T/F keeps True/False order.

const WEEKS = {
  5: [
    // Week 1 — AI fundamentals + intro to entrepreneurship
    { q: "What is Claude?", o: ["An AI assistant made by Anthropic", "A search engine that returns a list of links", "A social media app for founders", "A robot that runs businesses on its own"] },
    { q: "How does a large language model like Claude produce an answer?", o: ["It predicts likely next words based on patterns learned from lots of text", "It looks the answer up in a single fact database", "It copies the first website it finds", "A human types the reply in real time"], t: 25 },
    { q: "Claude gives you a confident-sounding market statistic. It's fine to put it straight into your pitch deck.", tf: false },
    { q: "Which prompt will get the most useful business ideas?", o: [
        "\"You're a startup coach. I'm 16, in NYC, love sneakers, and have $200. Give me 5 ideas that solve a real problem for teens, who pays, and why.\"",
        "\"Give me a business idea.\"",
        "\"Make me rich.\"",
        "\"Business ideas pls\"",
      ], t: 30 },
    { q: "Your prompt keeps returning generic ideas. What's the most effective fix?", o: ["Add context: who you are, the customer, your constraints, and the format you want", "Send the exact same prompt again", "Rewrite it in ALL CAPS", "Make it as short as possible"], t: 25 },
    { q: "What's the strongest starting point for a startup?", o: ["A frustrating problem you've seen real people struggle with", "A cool technology looking for a use", "A great name and logo", "An idea you're sure has no competitors (without checking)"], t: 25 },
    { q: "A founder asks Claude to write fake 5-star reviews for launch day. Best response?", o: ["Don't — it deceives customers and can break the law and platform rules", "Fine, as long as the product is actually good", "Fine, because the AI wrote them, not the founder", "Fine if it's fewer than 10 reviews"], t: 25 },
    { q: "Which of these should you NOT paste into an AI tool?", o: ["Customers' personal info (names, phone numbers) without their permission", "A rough draft of your own business idea", "A public news article about your industry", "Your pitch deck outline"] },
    { q: "Claude says your ideal customer is \"busy moms.\" What's the best founder move?", o: ["Treat it as a hypothesis and test it by talking to real people", "Accept it — AI has seen more data than you", "Stop using AI for customer research entirely", "Re-ask Claude until it gives a different answer"], t: 25 },
    { q: "Using Claude as a \"thought partner\" means…", o: ["You make the decisions; Claude helps you generate options, critique and draft", "Claude makes the key decisions for you", "Claude does the work so you don't have to understand it", "Claude replaces talking to customers"] },
    { q: "Why do founders map their strengths early on?", o: ["So roles cover what the business needs and gaps are obvious", "To decide who deserves the prize", "So everyone does the same job", "Because investors only fund one skill"] },
    { q: "An entrepreneur's core job is to…", o: ["Find a real problem and build a solution people will pay for", "Have the most original idea in the world", "Raise as much money as possible first", "Build the product without talking to anyone"] },
  ],
  10: [
    // Week 2 — Business Model Canvas + ICP + prototyping
    { q: "The Business Model Canvas is…", o: ["A one-page map of how a business creates, delivers and captures value", "A 40-page business plan", "A tool for designing a logo", "A spreadsheet of monthly expenses"] },
    { q: "Which canvas block answers \"Who are we creating value for?\"", o: ["Customer Segments", "Key Partners", "Cost Structure", "Key Resources"] },
    { q: "The Value Proposition block describes…", o: ["Why customers choose you — the problem you solve or the gain you create", "How much the product costs to make", "Who your investors are", "Your company's mission statement"] },
    { q: "The Channels block describes…", o: ["How you reach customers and deliver the product to them", "Your social media follower count", "The tools your team uses internally", "Where you get your supplies"] },
    { q: "The Revenue Streams block describes…", o: ["How the business earns money from each customer segment", "Every cost the business pays", "How fast the company is growing", "Which partners you work with"] },
    { q: "Which is the strongest Ideal Customer Profile?", o: [
        "NYC high school juniors in AP classes who study 2+ hrs a night and already pay for study apps",
        "Everyone who wants to learn",
        "Students",
        "People who like technology",
      ], t: 25 },
    { q: "Why is \"everyone\" a weak target customer for a new startup?", o: ["You can't reach, message or build for everyone — focus wins your first customers", "Because everyone already has the product", "Investors don't allow it", "It's actually the best target"], t: 25 },
    { q: "Lemonade stand: you sell 50 cups at $2. Each cup costs $0.50 to make, and your sign cost $20. What's your profit?", o: ["$55", "$100", "$75", "$45"], t: 35 },
    { q: "Lemonade stand: a cup sells for $2 and costs $0.50 to make. What's the gross margin per cup?", o: ["$1.50", "$2.50", "$0.50", "$1.00"], t: 25 },
    { q: "The main job of an early prototype is to…", o: ["Test your riskiest assumption quickly and cheaply with real users", "Be polished enough to sell to thousands of people", "Impress judges with design", "Replace the need for customer feedback"], t: 25 },
    { q: "What does MVP stand for?", o: ["Minimum Viable Product", "Most Valuable Player", "Maximum Value Proposition", "Minimum Visual Prototype"] },
    { q: "You should finish building the full product before showing it to anyone.", tf: false },
  ],
  15: [
    // Week 3 — Go-to-market, market sizing, marketing, finance
    { q: "TAM stands for Total Addressable Market. It means…", o: ["Total demand for the product if you captured 100% of the market", "The customers you'll win this year", "The number of competitors in your space", "Your total monthly revenue"], t: 25 },
    { q: "SAM (Serviceable Addressable Market) is…", o: ["The part of TAM you can actually serve with your product, channels and location", "Every person on Earth", "Your revenue after costs", "The market your competitor owns"], t: 25 },
    { q: "SOM (Serviceable Obtainable Market) is…", o: ["The share of SAM you can realistically capture in the near term", "The same as TAM", "The price of your product", "The number of investors interested"], t: 25 },
    { q: "Bottom-up sizing: 30,000 target customers × $60 per customer per year = ?", o: ["$1.8 million", "$180,000", "$18 million", "$600,000"], t: 30 },
    { q: "Why do judges trust bottom-up market sizing more than \"we just need 1% of a $10B market\"?", o: ["It's built from real customer counts and prices, so it's believable", "Bigger numbers always look better", "Top-down sizing is illegal", "It doesn't need any research"], t: 25 },
    { q: "Which of these is PRIMARY research?", o: ["Interviewing 10 potential customers yourself", "Reading an industry report", "Asking Claude to summarize a market", "Googling market statistics"] },
    { q: "Revenue = ?", o: ["Price × number of units sold", "Price − cost", "Costs + profit − price", "Number of customers ÷ price"] },
    { q: "Profit = ?", o: ["Revenue − costs", "Revenue + costs", "Price × customers", "Costs − revenue"] },
    { q: "Which is value-based pricing?", o: ["Pricing based on how much the problem is worth to the customer", "Cost to make it plus a fixed markup", "Always being the cheapest option", "Copying a competitor's price exactly"], t: 25 },
    { q: "Each unit costs you $4 to make and you want a 60% gross margin. What should you charge?", o: ["$10", "$6.40", "$8", "$2.40"], t: 40 },
    { q: "Fixed costs are $500 and you make $5 profit on each unit. How many units to break even?", o: ["100", "500", "50", "2,500"], t: 30 },
    { q: "CAC stands for…", o: ["Customer Acquisition Cost", "Cash After Costs", "Customer Annual Commitment", "Company Asset Count"] },
    { q: "Which go-to-market plan is strongest for your first 100 customers?", o: [
        "Partner with 3 school clubs, demo at their meetings, offer a free first month, track sign-ups weekly",
        "Go viral on TikTok",
        "Run a Super Bowl ad",
        "Build it and people will find it",
      ], t: 30 },
  ],
};

// Deterministic shuffle (so regenerating doesn't churn the SQL diff).
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sql = (s) => "'" + s.replace(/'/g, "''") + "'";

const out = [];
out.push(`-- =============================================================================
-- Migration 0003: end-of-week quiz questions (Weeks 1–3)
-- =============================================================================
-- GENERATED by scripts/quiz-bank.mjs — edit the bank there and regenerate.
-- Idempotent: clears each weekly quiz's questions, then reseeds.
-- =============================================================================
`);

for (const [dayNumber, questions] of Object.entries(WEEKS)) {
  const quizSel = `select id from public.quizzes where day_id = (select id from public.program_days where day_number = ${dayNumber}) limit 1`;
  out.push(`\n-- Day ${dayNumber}`);
  out.push(`delete from public.quiz_questions where quiz_id = (${quizSel});`);

  questions.forEach((item, idx) => {
    const rand = seeded(Number(dayNumber) * 1000 + idx);
    const isTf = "tf" in item;
    const opts = isTf
      ? [["True", item.tf === true], ["False", item.tf === false]]
      : shuffle(item.o.map((label, i) => [label, i === 0]), rand);
    const time = item.t ?? 20;
    const values = opts
      .map(([label, correct], i) => `      (${i + 1}, ${sql(label)}, ${correct})`)
      .join(",\n");
    out.push(`with q as (
  insert into public.quiz_questions (quiz_id, position, prompt, question_type, time_limit_seconds)
  select id, ${idx + 1}, ${sql(item.q)}, '${isTf ? "tf" : "mc"}', ${time} from public.quizzes
   where day_id = (select id from public.program_days where day_number = ${dayNumber}) limit 1
  returning id
)
insert into public.quiz_options (question_id, position, label, is_correct)
select q.id, v.pos, v.label, v.correct
from q, (values
${values}
) as v(pos, label, correct);`);
  });
}

console.log(out.join("\n"));
