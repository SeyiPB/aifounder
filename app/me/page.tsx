import { Me } from "./Me";

export const dynamic = "force-dynamic";

// Public — no auth. Students sign in with their personal 4-digit PIN.
export default function MePage() {
  return (
    <main className="min-h-screen bg-ink text-white">
      <Me />
    </main>
  );
}
