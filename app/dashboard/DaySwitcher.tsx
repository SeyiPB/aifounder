"use client";

import { useRouter } from "next/navigation";
import type { ProgramDay } from "@/lib/types";

export function DaySwitcher({
  days,
  selectedId,
}: {
  days: ProgramDay[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selectedId}
      onChange={(e) => router.push(`/dashboard?day=${e.target.value}`)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-navy shadow-sm focus:border-brand focus:outline-none"
    >
      {days.map((d) => (
        <option key={d.id} value={d.id}>
          Day {d.day_number} — {d.title}
        </option>
      ))}
    </select>
  );
}
