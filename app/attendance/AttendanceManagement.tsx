"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { resolveCurrentDay } from "@/lib/program";
import { bulkSetAttendance, updateSingleAttendance } from "./actions";
import type { Attendance, AttendanceStatus, ProgramDay, Student } from "@/lib/types";

interface AttendanceManagementProps {
  initialStudents: Student[];
  initialDays: ProgramDay[];
  initialAttendance: Attendance[];
}

const STATUSES: { value: AttendanceStatus; label: string; cls: string; softCls: string }[] = [
  { value: "present", label: "Present", cls: "bg-emerald-500 text-white", softCls: "bg-emerald-100 text-emerald-800" },
  { value: "late", label: "Late", cls: "bg-amber-500 text-white", softCls: "bg-amber-100 text-amber-800" },
  { value: "absent", label: "Absent", cls: "bg-rose-500 text-white", softCls: "bg-rose-100 text-rose-800" },
  { value: "excused", label: "Excused", cls: "bg-slate-400 text-white", softCls: "bg-slate-100 text-slate-800" },
];

export function AttendanceManagement({
  initialStudents,
  initialDays,
  initialAttendance,
}: AttendanceManagementProps) {
  const [students] = useState<Student[]>(initialStudents);
  const [days] = useState<ProgramDay[]>(initialDays);
  const [attendance, setAttendance] = useState<Attendance[]>(initialAttendance);

  // UI state
  const [viewMode, setViewMode] = useState<"checklist" | "heatmap">("checklist");
  const [selectedDayId, setSelectedDayId] = useState("");

  // Daily checklist inputs state
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | "">>({});
  const [arrivalTimes, setArrivalTimes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Heatmap click modal state
  const [editingCell, setEditingCell] = useState<{
    student: Student;
    day: ProgramDay;
    record: Attendance | null;
  } | null>(null);

  // Form states in the modal
  const [cellStatus, setCellStatus] = useState<AttendanceStatus | "">("");
  const [cellTime, setCellTime] = useState("");
  const [cellNotes, setCellNotes] = useState("");
  const [cellError, setCellError] = useState("");

  // Saving states
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Find selected day
  const selectedDay = useMemo(() => {
    return days.find((d) => d.id === selectedDayId) || days[0];
  }, [days, selectedDayId]);

  // Set default day on load
  useEffect(() => {
    const current = resolveCurrentDay(days);
    if (current) {
      setSelectedDayId(current.id);
    } else if (days.length > 0) {
      setSelectedDayId(days[0].id);
    }
  }, [days]);

  // Synchronize inputs when selected day or attendance database changes
  useEffect(() => {
    if (!selectedDayId) return;

    const dayRecords = attendance.filter((a) => a.day_id === selectedDayId);
    const nextStatuses: Record<string, AttendanceStatus | ""> = {};
    const nextTimes: Record<string, string> = {};
    const nextNotes: Record<string, string> = {};

    students.forEach((st) => {
      const rec = dayRecords.find((r) => r.student_id === st.id);
      nextStatuses[st.id] = rec?.status || "";
      nextTimes[st.id] = rec?.arrival_time ? rec.arrival_time.slice(0, 5) : "";
      nextNotes[st.id] = rec?.notes || "";
    });

    setStatuses(nextStatuses);
    setArrivalTimes(nextTimes);
    setNotes(nextNotes);
  }, [selectedDayId, attendance, students]);

  // Helper to resolve record ID
  function findRecordId(studentId: string, dayId: string): string | null {
    return attendance.find((a) => a.student_id === studentId && a.day_id === dayId)?.id || null;
  }

  // Auto-save student record
  function autoSave(
    studentId: string,
    nextStatus: AttendanceStatus | "",
    nextTime: string,
    nextNote: string,
  ) {
    if (!nextStatus) return; // don't auto-save if no status selected

    setSavingId(studentId);
    const existingId = findRecordId(studentId, selectedDayId);

    startTransition(async () => {
      const res = await updateSingleAttendance(
        existingId,
        studentId,
        selectedDayId,
        nextStatus,
        nextNote,
        nextTime,
      );

      setSavingId(null);

      if (res.ok) {
        // Update local attendance cache to trigger UI re-renders
        setAttendance((prev) => {
          const filtered = prev.filter((a) => !(a.student_id === studentId && a.day_id === selectedDayId));
          const newRecord: Attendance = {
            id: existingId || Math.random().toString(),
            student_id: studentId,
            day_id: selectedDayId,
            status: nextStatus,
            arrival_time: nextTime ? `${nextTime}:00` : null,
            notes: nextNote || null,
            recorded_by: "Facilitator",
            created_at: new Date().toISOString(),
          };
          return [...filtered, newRecord];
        });
      } else {
        alert(res.error || "Failed to save record");
      }
    });
  }

  // Handle Checklist edits
  function changeStatus(studentId: string, value: AttendanceStatus) {
    setStatuses((s) => ({ ...s, [studentId]: value }));
    autoSave(studentId, value, arrivalTimes[studentId] || "", notes[studentId] || "");
  }

  function changeTime(studentId: string, value: string) {
    setArrivalTimes((t) => ({ ...t, [studentId]: value }));
    autoSave(studentId, statuses[studentId] as AttendanceStatus, value, notes[studentId] || "");
  }

  function changeNote(studentId: string, value: string) {
    setNotes((n) => ({ ...n, [studentId]: value }));
    autoSave(studentId, statuses[studentId] as AttendanceStatus, arrivalTimes[studentId] || "", value);
  }

  // Bulk set actions
  function markAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((st) => (next[st.id] = status));
    setStatuses(next);

    const updates = students.map((st) => ({
      studentId: st.id,
      status,
    }));

    startTransition(async () => {
      const res = await bulkSetAttendance(selectedDayId, updates);
      if (res.ok) {
        // Refresh local cash
        setAttendance((prev) => {
          const filtered = prev.filter((a) => a.day_id !== selectedDayId);
          const newRecords = students.map((st) => ({
            id: findRecordId(st.id, selectedDayId) || Math.random().toString(),
            student_id: st.id,
            day_id: selectedDayId,
            status,
            arrival_time: arrivalTimes[st.id] ? `${arrivalTimes[st.id]}:00` : null,
            notes: notes[st.id] || null,
            recorded_by: "Facilitator",
            created_at: new Date().toISOString(),
          }));
          return [...filtered, ...newRecords];
        });
      } else {
        alert(res.error || "Failed to update bulk attendance");
      }
    });
  }

  // Heatmap click actions
  function openEditCell(student: Student, day: ProgramDay) {
    const record = attendance.find((a) => a.student_id === student.id && a.day_id === day.id) || null;
    setEditingCell({ student, day, record });
    setCellStatus(record?.status || "");
    setCellTime(record?.arrival_time ? record.arrival_time.slice(0, 5) : "");
    setCellNotes(record?.notes || "");
    setCellError("");
  }

  function handleSaveCellModal(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCell) return;
    if (!cellStatus) {
      setCellError("Please select a status");
      return;
    }

    startTransition(async () => {
      const res = await updateSingleAttendance(
        editingCell.record?.id || null,
        editingCell.student.id,
        editingCell.day.id,
        cellStatus as AttendanceStatus,
        cellNotes,
        cellTime,
      );

      if (res.ok) {
        // Update local cash
        setAttendance((prev) => {
          const filtered = prev.filter(
            (a) => !(a.student_id === editingCell.student.id && a.day_id === editingCell.day.id),
          );
          const newRecord: Attendance = {
            id: editingCell.record?.id || Math.random().toString(),
            student_id: editingCell.student.id,
            day_id: editingCell.day.id,
            status: cellStatus as AttendanceStatus,
            arrival_time: cellTime ? `${cellTime}:00` : null,
            notes: cellNotes || null,
            recorded_by: "Facilitator",
            created_at: new Date().toISOString(),
          };
          return [...filtered, newRecord];
        });
        setEditingCell(null);
      } else {
        setCellError(res.error || "Failed to save record");
      }
    });
  }

  // Export CSV
  function exportCSV() {
    const headers = [
      "Student Name",
      "Nickname",
      "Cohort Year",
      ...days.map((d) => `Day ${d.day_number} (${d.date})`),
      "Days Present",
      "Days Late",
      "Days Absent",
      "Days Excused",
      "Total Recorded",
      "Attendance Rate (%)",
    ];

    const rows = students.map((s) => {
      const dayStatuses = days.map((d) => {
        const rec = attendance.find((a) => a.student_id === s.id && a.day_id === d.id);
        return rec ? rec.status : "unrecorded";
      });

      const recs = attendance.filter((a) => a.student_id === s.id);
      const present = recs.filter((a) => a.status === "present").length;
      const late = recs.filter((a) => a.status === "late").length;
      const absent = recs.filter((a) => a.status === "absent").length;
      const excused = recs.filter((a) => a.status === "excused").length;
      const total = recs.length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

      return [
        s.name,
        s.nickname || "",
        s.cohort_year,
        ...dayStatuses,
        present,
        late,
        absent,
        excused,
        total,
        `${rate}%`,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((val) => `"${val}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `FutureNYC_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Heatmap grouping by weeks
  const weeks = useMemo(() => {
    const groups: Record<number, ProgramDay[]> = { 1: [], 2: [], 3: [], 4: [] };
    days.forEach((d) => {
      if (groups[d.week_number]) {
        groups[d.week_number].push(d);
      }
    });
    return groups;
  }, [days]);

  return (
    <div className="space-y-6">
      {/* Top title and toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Attendance Hub</h1>
          <p className="text-sm text-slate-500">
            Record daily rolls, analyze trends via the weekly heatmap, and export report files.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            <button
              onClick={() => setViewMode("checklist")}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                viewMode === "checklist"
                  ? "bg-white text-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📝 Daily Checklist
            </button>
            <button
              onClick={() => setViewMode("heatmap")}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                viewMode === "heatmap"
                  ? "bg-white text-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🗺️ Weekly Heatmap
            </button>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            📊 Export CSV Report
          </button>
        </div>
      </div>

      {/* VIEW 1: DAILY CHECKLIST */}
      {viewMode === "checklist" && selectedDay && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Day details bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <select
                value={selectedDayId}
                onChange={(e) => setSelectedDayId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy focus:outline-none focus:border-brand"
              >
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    Day {d.day_number}: {d.title}
                  </option>
                ))}
              </select>
              <div className="hidden sm:block border-l border-slate-200 pl-3">
                <span className="text-xs font-semibold text-brand block uppercase tracking-wide">
                  {selectedDay.theme}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {new Date(selectedDay.date + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Quick Bulk Checklist */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wide mr-1">
                Mark All:
              </span>
              <button
                onClick={() => markAll("present")}
                disabled={pending}
                className="rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                Present
              </button>
              <button
                onClick={() => markAll("absent")}
                disabled={pending}
                className="rounded-md bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                Absent
              </button>
              <button
                onClick={() => markAll("excused")}
                disabled={pending}
                className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Excused
              </button>
            </div>
          </div>

          {/* Roster Table List */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">Roster Status</th>
                  <th className="px-6 py-3.5">Arrival Time</th>
                  <th className="px-6 py-3.5">Notes</th>
                  <th className="px-6 py-3.5 text-center w-12">Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const currentStatus = statuses[student.id];
                  const currentTime = arrivalTimes[student.id] || "";
                  const currentNote = notes[student.id] || "";
                  const isSaving = savingId === student.id;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-navy">
                          {student.name}
                        </span>
                        {student.nickname && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xxs font-medium text-slate-600">
                            {student.nickname}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5">
                          {STATUSES.map((s) => {
                            const active = currentStatus === s.value;
                            return (
                              <button
                                key={s.value}
                                disabled={pending}
                                onClick={() => changeStatus(student.id, s.value)}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                  active
                                    ? s.cls
                                    : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                }`}
                              >
                                {s.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="time"
                          value={currentTime}
                          disabled={pending}
                          onChange={(e) =>
                            setArrivalTimes((t) => ({ ...t, [student.id]: e.target.value }))
                          }
                          onBlur={(e) => changeTime(student.id, e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand focus:outline-none w-28"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={currentNote}
                          disabled={pending}
                          onChange={(e) =>
                            setNotes((n) => ({ ...n, [student.id]: e.target.value }))
                          }
                          onBlur={(e) => changeNote(student.id, e.target.value)}
                          placeholder="Excused reason, notes..."
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand focus:outline-none"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isSaving ? (
                          <span className="inline-block animate-spin text-sm">⏳</span>
                        ) : currentStatus ? (
                          <span className="text-emerald-500 font-bold text-xs">✓</span>
                        ) : (
                          <span className="text-slate-300 font-bold text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: WEEKLY HEATMAP GRID */}
      {viewMode === "heatmap" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 overflow-hidden animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-navy">Camp Grid Attendance Matrix</h3>
            <div className="flex flex-wrap gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1">
                <div className="h-3.5 w-3.5 rounded bg-emerald-500" /> Present
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3.5 w-3.5 rounded bg-amber-500" /> Late
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3.5 w-3.5 rounded bg-rose-500" /> Absent
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3.5 w-3.5 rounded bg-slate-400" /> Excused
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3.5 w-3.5 rounded border border-slate-200 border-dashed" /> Unrecorded
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
            <table className="w-full border-collapse text-xs text-slate-500 table-fixed min-w-[800px]">
              <thead>
                {/* Weeks Header Row */}
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2.5 font-bold text-slate-700 w-48 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                    Student
                  </th>
                  {[1, 2, 3, 4].map((wk) => (
                    <th
                      key={wk}
                      colSpan={weeks[wk]?.length || 1}
                      className="p-2 font-bold text-center text-navy uppercase tracking-wider border-r border-slate-200"
                    >
                      Week {wk}
                    </th>
                  ))}
                </tr>
                {/* Days Subheader Row */}
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="p-2.5 font-semibold text-slate-500 w-48 sticky left-0 bg-slate-50/50 z-10 border-r border-slate-200" />
                  {days.map((day) => (
                    <th
                      key={day.id}
                      className="p-1 font-semibold text-center border-r border-slate-100 hover:bg-slate-100/50 cursor-help"
                      title={`${day.date}: ${day.title}`}
                    >
                      D{day.day_number}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50">
                    {/* Frozen student column */}
                    <td className="p-2 font-bold text-navy w-48 sticky left-0 bg-white z-10 border-r border-slate-200 truncate">
                      {student.name}
                      {student.nickname && (
                        <span className="block text-xxs font-normal text-slate-400">
                          {student.nickname}
                        </span>
                      )}
                    </td>
                    {/* Attendance cell columns */}
                    {days.map((day) => {
                      const record =
                        attendance.find((a) => a.student_id === student.id && a.day_id === day.id) ||
                        null;

                      let cellColor = "bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed";
                      let tooltipStatus = "Unrecorded";

                      if (record) {
                        if (record.status === "present") {
                          cellColor = "bg-emerald-500 hover:bg-emerald-600";
                          tooltipStatus = "Present";
                        } else if (record.status === "late") {
                          cellColor = "bg-amber-500 hover:bg-amber-600";
                          tooltipStatus = `Late (${record.arrival_time?.slice(0, 5) || ""})`;
                        } else if (record.status === "absent") {
                          cellColor = "bg-rose-500 hover:bg-rose-600";
                          tooltipStatus = "Absent";
                        } else if (record.status === "excused") {
                          cellColor = "bg-slate-400 hover:bg-slate-500";
                          tooltipStatus = "Excused";
                        }
                      }

                      const tooltipText = `${student.name} — Day ${day.day_number} (${day.date})\nStatus: ${tooltipStatus}${
                        record?.notes ? `\nNotes: ${record.notes}` : ""
                      }`;

                      return (
                        <td
                          key={day.id}
                          className="p-1 text-center border-r border-slate-100 relative"
                        >
                          <button
                            onClick={() => openEditCell(student, day)}
                            title={tooltipText}
                            className={`w-6 h-6 sm:w-7 sm:h-7 mx-auto rounded transition-all cursor-pointer block ${cellColor}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Heatmap Cell Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-navy mb-1">Update Attendance Cell</h3>
            <p className="text-sm text-slate-700 font-semibold">
              {editingCell.student.name}{" "}
              <span className="text-xs text-slate-400 font-normal">
                ({editingCell.student.nickname})
              </span>
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Day {editingCell.day.day_number} ({editingCell.day.date}): {editingCell.day.title}
            </p>

            <form onSubmit={handleSaveCellModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Status
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCellStatus(st)}
                      className={`rounded-lg py-2 text-xs font-bold capitalize transition-all border ${
                        cellStatus === st
                          ? st === "present"
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : st === "late"
                            ? "bg-amber-500 text-white border-amber-500"
                            : st === "absent"
                            ? "bg-rose-500 text-white border-rose-500"
                            : "bg-slate-400 text-white border-slate-400"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Arrival Time (Optional)
                </label>
                <input
                  type="time"
                  value={cellTime}
                  onChange={(e) => setCellTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={cellNotes}
                  onChange={(e) => setCellNotes(e.target.value)}
                  placeholder="Explain reasons for tardiness, early release, or excusal notes..."
                  className="w-full h-20 rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              {cellError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  ⚠️ {cellError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Save Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
