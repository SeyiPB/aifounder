"use client";

import { useState, useTransition } from "react";
import { setAttendance } from "./actions";
import type { Attendance, AttendanceStatus, Student } from "@/lib/types";

const STATUSES: { value: AttendanceStatus; label: string; cls: string }[] = [
  { value: "present", label: "Present", cls: "bg-emerald-500 text-white" },
  { value: "late", label: "Late", cls: "bg-amber-500 text-white" },
  { value: "absent", label: "Absent", cls: "bg-rose-500 text-white" },
  { value: "excused", label: "Excused", cls: "bg-slate-400 text-white" },
];

export function AttendanceGrid({
  students,
  attendance,
  dayId,
}: {
  students: Student[];
  attendance: Attendance[];
  dayId: string;
}) {
  const initial: Record<string, AttendanceStatus | undefined> = {};
  attendance.forEach((a) => (initial[a.student_id] = a.status));

  const [statuses, setStatuses] = useState(initial);
  const [, startTransition] = useTransition();

  function update(studentId: string, status: AttendanceStatus) {
    const prev = statuses[studentId];
    setStatuses((s) => ({ ...s, [studentId]: status })); // optimistic
    startTransition(async () => {
      const res = await setAttendance(studentId, dayId, status);
      if (!res.ok) setStatuses((s) => ({ ...s, [studentId]: prev })); // rollback
    });
  }

  function markAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((st) => (next[st.id] = status));
    setStatuses(next);
    startTransition(async () => {
      await Promise.all(
        students.map((st) => setAttendance(st.id, dayId, status)),
      );
    });
  }

  const counts = STATUSES.map((s) => ({
    ...s,
    n: students.filter((st) => statuses[st.id] === s.value).length,
  }));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-navy">Attendance</h2>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => markAll("present")}
            className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100"
          >
            All present
          </button>
          <button
            onClick={() => markAll("absent")}
            className="rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700 hover:bg-rose-100"
          >
            All absent
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {counts.map((c) => (
          <span key={c.value} className="text-slate-600">
            <span className="font-semibold text-navy">{c.n}</span> {c.label.toLowerCase()}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-slate-100">
        {students.map((st) => (
          <li key={st.id} className="flex items-center justify-between gap-3 py-2">
            <span className="truncate text-sm font-medium text-slate-700">
              {st.nickname || st.name}
            </span>
            <div className="flex gap-1">
              {STATUSES.map((s) => {
                const active = statuses[st.id] === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => update(st.id, s.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      active ? s.cls : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
