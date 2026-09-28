import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function PinCardsPage() {
  const supabase = createClient();
  const { data: students } = await supabase
    .from("students")
    .select("*")
    .order("name");

  // Build the /play URL from the current request host.
  const h = headers();
  const host = h.get("host") || "aisummercamp.vercel.app";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const playUrl = `${proto}://${host}/play`;
  const playDisplay = `${host}/play`;

  const roster = (students || []) as Student[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 print:px-0 print:py-0">
      {/* Toolbar (hidden when printing) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/students" className="text-sm text-slate-500 hover:text-navy">
            ← Back to roster
          </Link>
          <h1 className="text-2xl font-bold text-navy">Quiz PIN Cards</h1>
          <p className="text-sm text-slate-500">
            One card per student. Print, cut along the lines, and hand out on day one.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
        {roster.map((s) => (
          <div
            key={s.id}
            className="flex break-inside-avoid flex-col rounded-xl border border-slate-300 bg-white p-4 text-center print:border print:border-slate-400"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">
              FutureNYC AI Camp
            </div>
            <div className="text-sm font-bold leading-tight text-navy">{s.name}</div>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Your Quiz PIN
            </div>
            <div className="font-mono text-3xl font-extrabold tracking-[0.3em] text-navy">
              {s.pin || "----"}
            </div>
            <div className="mt-3 border-t border-dashed border-slate-200 pt-2 text-[11px] leading-snug text-slate-500">
              Go to <span className="font-semibold text-navy">{playDisplay}</span>
              <br />
              Enter the code on screen + this PIN
            </div>
          </div>
        ))}
      </div>

      {roster.length === 0 && (
        <p className="text-slate-400">No students in the roster yet.</p>
      )}

      {/* Print sizing */}
      <style>{`
        @media print {
          @page { margin: 1cm; }
          nav, header { display: none !important; }
        }
      `}</style>
    </main>
  );
}
