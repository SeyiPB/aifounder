import { Play } from "./Play";

export const dynamic = "force-dynamic";

// Public — no auth. Students join with a join code + personal PIN.
export default function PlayPage() {
  return (
    <main className="min-h-screen bg-ink text-white">
      <Play />
    </main>
  );
}
