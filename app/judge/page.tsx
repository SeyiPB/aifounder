import { Judge } from "./Judge";

export const dynamic = "force-dynamic";

// Public — no auth. Judges score with their personal access code.
export default function JudgePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Judge />
    </main>
  );
}
