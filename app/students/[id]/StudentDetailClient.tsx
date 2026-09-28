"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateStudentAttendance,
  updatePointAward,
  deletePointAward,
} from "../actions";
import type {
  Student,
  Attendance,
  PointAward,
  ProgramDay,
  PointCategory,
  AttendanceStatus,
} from "@/lib/types";
import type { QuizReview } from "./page";

interface StudentDetailClientProps {
  student: Student;
  attendanceRecords: Attendance[];
  awardsRecords: PointAward[];
  programDays: ProgramDay[];
  categories: PointCategory[];
  quizReview: QuizReview[];
}

export function StudentDetailClient({
  student,
  attendanceRecords,
  awardsRecords,
  programDays,
  categories,
  quizReview,
}: StudentDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"attendance" | "points" | "quizzes">("attendance");

  // Modals state
  const [editingAttendance, setEditingAttendance] = useState<{
    day: ProgramDay;
    record: Attendance | null;
  } | null>(null);
  const [editingAward, setEditingAward] = useState<PointAward | null>(null);
  const [deletingAward, setDeletingAward] = useState<PointAward | null>(null);

  // Attendance Form states
  const [attStatus, setAttStatus] = useState<AttendanceStatus>("present");
  const [attTime, setAttTime] = useState("");
  const [attNotes, setAttNotes] = useState("");
  const [attError, setAttError] = useState("");

  // Award Form states
  const [awardPoints, setAwardPoints] = useState(0);
  const [awardNote, setAwardNote] = useState("");
  const [awardError, setAwardError] = useState("");

  const [pending, startTransition] = useTransition();

  // Mappings
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const dayMap = useMemo(() => {
    return new Map(programDays.map((d) => [d.id, d]));
  }, [programDays]);

  const attendanceByDayMap = useMemo(() => {
    return new Map(attendanceRecords.map((r) => [r.day_id, r]));
  }, [attendanceRecords]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalDays = attendanceRecords.length;
    const present = attendanceRecords.filter((r) => r.status === "present").length;
    const late = attendanceRecords.filter((r) => r.status === "late").length;
    const absent = attendanceRecords.filter((r) => r.status === "absent").length;
    const excused = attendanceRecords.filter((r) => r.status === "excused").length;

    const recordedPresent = present + late;
    const attendanceRate = totalDays > 0 ? Math.round((recordedPresent / totalDays) * 100) : 100;

    const totalPoints = awardsRecords.reduce((sum, r) => sum + r.points_awarded, 0);

    return {
      totalDays,
      present,
      late,
      absent,
      excused,
      attendanceRate,
      totalPoints,
    };
  }, [attendanceRecords, awardsRecords]);

  // Handle Modals Open
  function openEditAttendance(day: ProgramDay, record: Attendance | null) {
    setEditingAttendance({ day, record });
    setAttStatus(record?.status || "present");
    setAttTime(record?.arrival_time || "");
    setAttNotes(record?.notes || "");
    setAttError("");
  }

  function openEditAward(award: PointAward) {
    setEditingAward(award);
    setAwardPoints(award.points_awarded);
    setAwardNote(award.note || "");
    setAwardError("");
  }

  // Handle Form Submissions
  function handleSaveAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAttendance) return;

    startTransition(async () => {
      const res = await updateStudentAttendance(
        editingAttendance.record?.id || null,
        student.id,
        editingAttendance.day.id,
        attStatus,
        attNotes,
        attTime,
      );

      if (res.ok) {
        setEditingAttendance(null);
        window.location.reload();
      } else {
        setAttError(res.error || "Failed to update attendance");
      }
    });
  }

  function handleSaveAward(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAward) return;

    startTransition(async () => {
      const res = await updatePointAward(
        editingAward.id,
        student.id,
        awardPoints,
        awardNote,
      );

      if (res.ok) {
        setEditingAward(null);
        window.location.reload();
      } else {
        setAwardError(res.error || "Failed to update points award");
      }
    });
  }

  function handleDeleteAward() {
    if (!deletingAward) return;

    startTransition(async () => {
      const res = await deletePointAward(deletingAward.id, student.id);
      if (res.ok) {
        setDeletingAward(null);
        window.location.reload();
      } else {
        alert(res.error || "Failed to delete points award");
      }
    });
  }

  // Categories helper to validate range
  const editingAwardCategory = useMemo(() => {
    if (!editingAward) return null;
    return categoryMap.get(editingAward.category_id) || null;
  }, [editingAward, categoryMap]);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/students"
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-navy hover:underline"
        >
          ← Back to Student Roster
        </Link>
      </div>

      {/* Student Profile Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-navy">{student.name}</h1>
              {student.nickname && (
                <span className="rounded bg-brand/10 px-2.5 py-1 text-xs font-semibold text-navy">
                  Nickname: {student.nickname}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">Cohort Year: {student.cohort_year}</p>
          </div>
          <div className="flex gap-2">
            {/* Quick action triggers if needed, but Roster does CRUD, this displays history */}
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3 border-t border-slate-100 pt-6">
          {/* Total Points */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl">
              🪙
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Points
              </p>
              <h4 className="text-xl font-bold text-slate-800">{stats.totalPoints} pts</h4>
            </div>
          </div>

          {/* Attendance Rate */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
              📅
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Attendance Rate
              </p>
              <h4 className="text-xl font-bold text-slate-800">
                {stats.attendanceRate}%{" "}
                <span className="text-xs font-normal text-slate-400">
                  ({stats.present + stats.late}/{stats.totalDays} days)
                </span>
              </h4>
            </div>
          </div>

          {/* Attendance Breakdown */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
              {stats.present} present
            </span>
            <span className="rounded bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
              {stats.late} late
            </span>
            <span className="rounded bg-rose-50 px-2.5 py-1 font-semibold text-rose-800">
              {stats.absent} absent
            </span>
            <span className="rounded bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              {stats.excused} excused
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("attendance")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "attendance"
                ? "border-brand text-navy"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Attendance Calendar
          </button>
          <button
            onClick={() => setActiveTab("points")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "points"
                ? "border-brand text-navy"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Points History ({awardsRecords.length})
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "quizzes"
                ? "border-brand text-navy"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Quiz Answers ({quizReview.length})
          </button>
        </div>

        {/* Tab 3: Quiz Answers */}
        {activeTab === "quizzes" && (
          <div className="space-y-4">
            {quizReview.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
                {student.name} hasn&apos;t answered any quiz questions yet.
              </div>
            ) : (
              quizReview.map((qz) => (
                <div
                  key={qz.quizId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-navy">
                      {qz.dayNumber ? `Day ${qz.dayNumber}: ` : ""}
                      {qz.title}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${
                        qz.correctCount === qz.total
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {qz.correctCount}/{qz.total} correct
                    </span>
                  </div>
                  <ol className="space-y-3">
                    {qz.questions.map((q, i) => (
                      <li key={i} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                        <p className="text-sm font-medium text-slate-800">
                          {i + 1}. {q.prompt}
                        </p>
                        <p className="mt-1 text-sm">
                          <span className={q.correct ? "text-emerald-700" : "text-rose-600"}>
                            {q.correct ? "✅" : "❌"} Their answer: {q.chosenLabel ?? "—"}
                          </span>
                        </p>
                        {!q.correct && (
                          <p className="mt-0.5 text-sm text-emerald-700">
                            ✔ Correct answer: {q.correctLabel}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 1: Attendance Log */}
        {activeTab === "attendance" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-navy">Program Days Attendance Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Day & Date</th>
                    <th className="p-3">Topic / Theme</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Arrival</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {programDays.map((day) => {
                    const record = attendanceByDayMap.get(day.id) || null;
                    let badgeClass = "bg-slate-100 text-slate-400";
                    let label = "Not Recorded";

                    if (record) {
                      if (record.status === "present") {
                        badgeClass = "bg-emerald-50 text-emerald-700";
                        label = "Present";
                      } else if (record.status === "late") {
                        badgeClass = "bg-amber-50 text-amber-700";
                        label = "Late";
                      } else if (record.status === "absent") {
                        badgeClass = "bg-rose-50 text-rose-700";
                        label = "Absent";
                      } else if (record.status === "excused") {
                        badgeClass = "bg-slate-100 text-slate-700";
                        label = "Excused";
                      }
                    }

                    return (
                      <tr key={day.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <span className="font-bold text-navy block">Day {day.day_number}</span>
                          <span className="text-xs text-slate-400 font-medium">
                            {new Date(day.date + "T00:00:00").toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="block font-medium text-slate-700 truncate max-w-xs">
                            {day.title}
                          </span>
                          <span className="text-xs text-slate-400 block truncate max-w-xs">
                            {day.theme || "—"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-block rounded px-2.5 py-0.5 text-xs font-bold ${badgeClass}`}>
                            {label}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-slate-700">
                          {record?.arrival_time ? record.arrival_time.slice(0, 5) : "—"}
                        </td>
                        <td className="p-3 text-xs text-slate-500 italic max-w-xs truncate">
                          {record?.notes || "—"}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openEditAttendance(day, record)}
                            className="text-xs font-semibold text-navy hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Points History */}
        {activeTab === "points" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-navy">Point Awards List</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Day</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Points</th>
                    <th className="p-3">Note</th>
                    <th className="p-3">Awarded By</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {awardsRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No points awarded to this student yet.
                      </td>
                    </tr>
                  ) : (
                    [...awardsRecords]
                      .sort(
                        (a, b) =>
                          (dayMap.get(b.day_id)?.day_number || 0) -
                            (dayMap.get(a.day_id)?.day_number || 0) ||
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                      )
                      .map((award) => {
                        const day = dayMap.get(award.day_id);
                        const cat = categoryMap.get(award.category_id);
                        const points = award.points_awarded;

                        return (
                          <tr key={award.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <span className="font-bold text-navy block">
                                Day {day?.day_number || "?"}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{cat?.icon}</span>
                                <span className="font-medium text-slate-700">
                                  {cat?.name || "Unknown Category"}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`font-bold ${
                                  points >= 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {points >= 0 ? "+" : ""}
                                {points}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-slate-500 max-w-xs truncate">
                              {award.note || "—"}
                            </td>
                            <td className="p-3 text-xs text-slate-400">
                              {award.awarded_by || "—"}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2.5">
                                <button
                                  onClick={() => openEditAward(award)}
                                  className="text-xs font-semibold text-slate-500 hover:text-navy"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setDeletingAward(award)}
                                  className="text-xs font-semibold text-slate-400 hover:text-rose-600"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Attendance Modal */}
      {editingAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-navy mb-1">Edit Attendance</h3>
            <p className="text-xs text-slate-500 mb-4">
              Day {editingAttendance.day.day_number}: {editingAttendance.day.title}
            </p>

            <form onSubmit={handleSaveAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Status
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAttStatus(st)}
                      className={`rounded-lg py-2 text-xs font-bold capitalize transition-all border ${
                        attStatus === st
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
                  value={attTime}
                  onChange={(e) => setAttTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Facilitator Notes (Optional)
                </label>
                <textarea
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                  placeholder="Add details about excusal, reason for lateness, etc."
                  className="w-full h-20 rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              {attError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  ⚠️ {attError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAttendance(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Point Award Modal */}
      {editingAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-navy mb-1">Edit Point Award</h3>
            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
              <span>{editingAwardCategory?.icon}</span>
              <strong>{editingAwardCategory?.name}</strong>
            </p>

            <form onSubmit={handleSaveAward} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Points
                </label>
                <input
                  type="number"
                  required
                  value={awardPoints}
                  onChange={(e) => setAwardPoints(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
                {editingAwardCategory?.min_points !== null &&
                  editingAwardCategory?.max_points !== null && (
                    <span className="text-xs text-slate-400 mt-1 block">
                      Allowed range: {editingAwardCategory?.min_points} to{" "}
                      {editingAwardCategory?.max_points} points
                    </span>
                  )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Note {editingAwardCategory?.requires_note && "(Required)"}
                </label>
                <input
                  type="text"
                  required={editingAwardCategory?.requires_note}
                  value={awardNote}
                  onChange={(e) => setAwardNote(e.target.value)}
                  placeholder="Detail explaining why points are awarded..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              {awardError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  ⚠️ {awardError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAward(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Save Award"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Award Confirmation Modal */}
      {deletingAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-rose-600 mb-2">Delete Point Award?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete this award of{" "}
              <strong className="text-navy">
                {deletingAward.points_awarded >= 0 ? "+" : ""}
                {deletingAward.points_awarded} points
              </strong>{" "}
              from category{" "}
              <strong>{categoryMap.get(deletingAward.category_id)?.name}</strong>?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setDeletingAward(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAward}
                disabled={pending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
