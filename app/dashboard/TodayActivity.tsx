import type { PointAward, PointCategory, Student } from "@/lib/types";

export function TodayActivity({
  awards,
  students,
  categories,
}: {
  awards: PointAward[];
  students: Student[];
  categories: PointCategory[];
}) {
  const sMap = new Map(students.map((s) => [s.id, s]));
  const cMap = new Map(categories.map((c) => [c.id, c]));
  const total = awards.reduce((sum, a) => sum + a.points_awarded, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-navy">Today&apos;s awards</h2>
        <span className="text-sm text-slate-500">
          {awards.length} awards · <span className="font-semibold text-navy">{total}</span> pts
        </span>
      </div>

      {awards.length === 0 ? (
        <p className="text-sm text-slate-400">No points awarded yet today.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-auto">
          {awards.map((a) => {
            const s = sMap.get(a.student_id);
            const c = cMap.get(a.category_id);
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <span className="truncate">
                  <span className="mr-1">{c?.icon}</span>
                  <span className="font-medium text-navy">
                    {s?.nickname || s?.name || "Unknown"}
                  </span>
                  {a.note && <span className="text-slate-400"> — {a.note}</span>}
                </span>
                <span
                  className={`shrink-0 font-semibold ${
                    a.points_awarded < 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {a.points_awarded >= 0 ? "+" : ""}
                  {a.points_awarded}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
