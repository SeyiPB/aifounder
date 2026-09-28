"use client";

import { useMemo, useState, useTransition, useRef } from "react";
import Link from "next/link";
import {
  addStudent,
  updateStudent,
  deleteStudent,
  bulkImportStudents,
} from "./actions";
import type { Student } from "@/lib/types";
import { GENDER_OPTIONS } from "@/lib/types";

interface StudentRosterProps {
  initialStudents: Student[];
  initialTotals: { student_id: string; name: string; nickname: string | null; total_points: number }[];
  initialAttendance: { student_id: string; status: string }[];
}

export function StudentRoster({
  initialStudents,
  initialTotals,
  initialAttendance,
}: StudentRosterProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [totals, setTotals] = useState(initialTotals);
  const [attendance, setAttendance] = useState(initialAttendance);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCohort, setSelectedCohort] = useState("all");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formNickname, setFormNickname] = useState("");
  const [formCohortYear, setFormCohortYear] = useState(2026);
  const [formGender, setFormGender] = useState("");
  const [formError, setFormError] = useState("");

  // CSV Import States
  const [csvText, setCsvText] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();

  // Mappings
  const pointsMap = useMemo(() => {
    return new Map(totals.map((t) => [t.student_id, t.total_points]));
  }, [totals]);

  const attendanceStatsMap = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();
    attendance.forEach((a) => {
      if (!map.has(a.student_id)) {
        map.set(a.student_id, { present: 0, total: 0 });
      }
      const stats = map.get(a.student_id)!;
      stats.total += 1;
      if (a.status === "present" || a.status === "late") {
        stats.present += 1;
      }
    });
    return map;
  }, [attendance]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalCount = students.length;
    if (totalCount === 0) return { count: 0, avgAttendance: 0, totalPoints: 0 };

    let sumPoints = 0;
    totals.forEach((t) => (sumPoints += t.total_points));

    let sumAttendanceRate = 0;
    students.forEach((s) => {
      const stats = attendanceStatsMap.get(s.id);
      if (!stats || stats.total === 0) {
        sumAttendanceRate += 100; // default to 100 if no record
      } else {
        sumAttendanceRate += (stats.present / stats.total) * 100;
      }
    });

    return {
      count: totalCount,
      avgAttendance: Math.round(sumAttendanceRate / totalCount),
      totalPoints: sumPoints,
    };
  }, [students, totals, attendanceStatsMap]);

  // Cohort list
  const cohortsList = useMemo(() => {
    const years = new Set(students.map((s) => s.cohort_year));
    return Array.from(years).sort((a, b) => b - a);
  }, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          s.name.toLowerCase().includes(query) ||
          (s.nickname && s.nickname.toLowerCase().includes(query));
        const matchesCohort =
          selectedCohort === "all" || s.cohort_year.toString() === selectedCohort;
        return matchesSearch && matchesCohort;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, searchQuery, selectedCohort]);

  // Modals actions
  function openAddModal() {
    setFormName("");
    setFormNickname("");
    setFormCohortYear(2026);
    setFormGender("");
    setFormError("");
    setShowAddModal(true);
  }

  function openEditModal(student: Student) {
    setEditingStudent(student);
    setFormName(student.name);
    setFormNickname(student.nickname || "");
    setFormCohortYear(student.cohort_year);
    setFormGender(student.gender || "");
    setFormError("");
  }

  // Handle forms submit
  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }
    startTransition(async () => {
      const res = await addStudent(formName, formNickname, formCohortYear, formGender);
      if (res.ok) {
        // Refresh local states will trigger because of page revalidation,
        // but for immediate responsive feedback we can let Next.js refresh.
        window.location.reload();
      } else {
        setFormError(res.error || "Failed to add student");
      }
    });
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent) return;
    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }
    startTransition(async () => {
      const res = await updateStudent(
        editingStudent.id,
        formName,
        formNickname,
        formCohortYear,
        formGender,
      );
      if (res.ok) {
        window.location.reload();
      } else {
        setFormError(res.error || "Failed to update student");
      }
    });
  }

  function handleDelete() {
    if (!deletingStudent) return;
    startTransition(async () => {
      const res = await deleteStudent(deletingStudent.id);
      if (res.ok) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to delete student");
      }
    });
  }

  // CSV parsing
  const parsedCsvStudents = useMemo(() => {
    if (!csvText.trim()) return [];

    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];

    const firstLine = lines[0].toLowerCase();
    const hasHeaders =
      firstLine.includes("name") ||
      firstLine.includes("nickname") ||
      firstLine.includes("cohort");

    let startIndex = 0;
    let nameCol = -1;
    let nickCol = -1;
    let cohortCol = -1;

    if (hasHeaders) {
      startIndex = 1;
      const headers = parseCSVLine(lines[0]);
      headers.forEach((h, idx) => {
        const clean = h.trim().toLowerCase();
        if (clean === "name" || clean.includes("student")) nameCol = idx;
        else if (clean === "nickname" || clean.includes("nick")) nickCol = idx;
        else if (
          clean === "cohort" ||
          clean.includes("year") ||
          clean.includes("cohort_year")
        )
          cohortCol = idx;
      });
    }

    if (nameCol === -1) {
      nameCol = 0;
    }

    const results: { name: string; nickname?: string; cohortYear?: number }[] =
      [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line);
      const name = cols[nameCol]?.trim() || "";
      const nickname = nickCol !== -1 ? cols[nickCol]?.trim() : cols[1]?.trim();
      const cohortStr =
        cohortCol !== -1 ? cols[cohortCol]?.trim() : cols[2]?.trim();
      const cohortYear = cohortStr ? parseInt(cohortStr, 10) : undefined;

      if (name) {
        results.push({
          name,
          nickname: nickname || undefined,
          cohortYear: cohortYear && !isNaN(cohortYear) ? cohortYear : undefined,
        });
      }
    }

    return results;
  }, [csvText]);

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map((c) => {
      let s = c.trim();
      if (s.startsWith('"') && s.endsWith('"')) {
        s = s.slice(1, -1);
      }
      return s;
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text || "");
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (parsedCsvStudents.length === 0) return;
    startTransition(async () => {
      const res = await bulkImportStudents(parsedCsvStudents, replaceMode);
      if (res.ok) {
        window.location.reload();
      } else {
        setImportError(res.error || "Failed to import roster");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Student Roster</h1>
          <p className="text-sm text-slate-500">
            Manage student registrations, review attendance, points tallies, and bulk import.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/students/pin-cards"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            🖨 PIN Cards
          </Link>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            📥 Bulk Import CSV
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover transition"
          >
            ➕ Add Student
          </button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Students
          </p>
          <h3 className="mt-1 text-3xl font-bold text-navy">{aggregateStats.count}</h3>
          <p className="mt-1 text-xs text-slate-500">Registered in camp</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Avg Camp Attendance
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-navy">{aggregateStats.avgAttendance}%</h3>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
            <div
              style={{ width: `${aggregateStats.avgAttendance}%` }}
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Points Awarded
          </p>
          <h3 className="mt-1 text-3xl font-bold text-navy">
            🪙 {aggregateStats.totalPoints.toLocaleString()}
          </h3>
          <p className="mt-1 text-xs text-slate-500">Across all students</p>
        </div>
      </div>

      {/* Roster Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="min-w-[200px] flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students by name or nickname..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Cohort
          </label>
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-brand"
          >
            <option value="all">All Cohorts</option>
            {cohortsList.map((y) => (
              <option key={y} value={y.toString()}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Roster Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3.5">Name</th>
              <th className="px-6 py-3.5">Nickname</th>
              <th className="px-6 py-3.5">Quiz PIN</th>
              <th className="px-6 py-3.5">Gender</th>
              <th className="px-6 py-3.5">Cohort</th>
              <th className="px-6 py-3.5">Attendance</th>
              <th className="px-6 py-3.5">Total Points</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                  No students found matching filters.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => {
                const totalPoints = pointsMap.get(student.id) || 0;
                const attStats = attendanceStatsMap.get(student.id) || {
                  present: 0,
                  total: 0,
                };
                const attRate =
                  attStats.total > 0
                    ? Math.round((attStats.present / attStats.total) * 100)
                    : 100;

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/students/${student.id}`}
                        className="font-semibold text-navy hover:underline"
                      >
                        {student.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      {student.nickname ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {student.nickname}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {student.pin ? (
                        <span className="rounded bg-navy/5 px-2 py-1 font-mono text-sm font-bold tracking-widest text-navy">
                          {student.pin}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {student.gender
                        ? GENDER_OPTIONS.find((g) => g.value === student.gender)?.label
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">
                      {student.cohort_year}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                            attRate >= 90
                              ? "bg-emerald-50 text-emerald-700"
                              : attRate >= 75
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {attRate}%
                        </span>
                        <span className="text-xs text-slate-400">
                          ({attStats.present}/{attStats.total} days)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      🪙 {totalPoints}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/students/${student.id}`}
                          className="text-xs font-semibold text-navy hover:underline"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => openEditModal(student)}
                          className="text-xs font-semibold text-slate-500 hover:text-navy"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingStudent(student)}
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

      {/* Add / Edit Student Modal */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-navy mb-4">
              {showAddModal ? "Add New Student" : "Edit Student"}
            </h3>
            <form onSubmit={showAddModal ? handleAdd : handleEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Seyi Fakoya"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nickname (Optional)
                </label>
                <input
                  type="text"
                  value={formNickname}
                  onChange={(e) => setFormNickname(e.target.value)}
                  placeholder="e.g. Seyi"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Cohort Year
                </label>
                <input
                  type="number"
                  required
                  value={formCohortYear}
                  onChange={(e) => setFormCohortYear(Number(e.target.value))}
                  placeholder="2026"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Gender (optional)
                </label>
                <select
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">—</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingStudent(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-rose-600 mb-2">Delete Student?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-bold text-navy">{deletingStudent.name}</span>?
            </p>
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 mb-6">
              ⚠️ <strong>Warning:</strong> Deleting this student will immediately and
              permanently delete all of their attendance records and points awards. This action
              cannot be undone.
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setDeletingStudent(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-navy mb-2">📥 Bulk Import Students</h3>
            <p className="text-xs text-slate-500 mb-4">
              Paste CSV data or upload a file. Supported headers: <code>name</code>,{" "}
              <code>nickname</code> (optional), <code>cohort_year</code> (optional). If no
              headers, we default to: name (col 1), nickname (col 2), cohort (col 3).
            </p>

            <div className="space-y-4">
              {/* File upload */}
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".csv,.txt"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  📁 Upload CSV File
                </button>
                {fileInputRef.current?.files?.[0] && (
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">
                    {fileInputRef.current.files[0].name}
                  </span>
                )}
              </div>

              {/* Paste Text area */}
              <div>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="name,nickname,cohort_year&#10;Alice Smith,Ali,2026&#10;Bob Jones,,2026"
                  className="w-full h-32 rounded-lg border border-slate-300 p-2.5 text-sm font-mono focus:border-brand focus:outline-none"
                />
              </div>

              {/* Replace mode checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="replaceMode"
                  checked={replaceMode}
                  onChange={(e) => setReplaceMode(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <label htmlFor="replaceMode" className="text-sm font-semibold text-navy">
                  Replace entire roster (Clean Slate)
                </label>
              </div>

              {replaceMode && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 space-y-1">
                  <strong>⚠️ Warning:</strong> Checking this option will delete all existing
                  students and all of their point history and attendance records before importing the
                  new roster. This is ideal when setting up a fresh cohort for the first time.
                </div>
              )}

              {/* Preview parsed data */}
              {parsedCsvStudents.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2 font-bold text-slate-500">Name</th>
                        <th className="p-2 font-bold text-slate-500">Nickname</th>
                        <th className="p-2 font-bold text-slate-500">Cohort Year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parsedCsvStudents.map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-medium text-slate-800">{p.name}</td>
                          <td className="p-2 text-slate-500">{p.nickname || "—"}</td>
                          <td className="p-2 text-slate-500">{p.cohortYear || 2026}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {importError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  ⚠️ {importError}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-slate-500 font-semibold">
                  {parsedCsvStudents.length > 0
                    ? `Parsed ${parsedCsvStudents.length} student(s)`
                    : "No data parsed"}
                </span>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setCsvText("");
                      setReplaceMode(false);
                      setImportError("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={parsedCsvStudents.length === 0 || pending}
                    className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover disabled:opacity-50"
                  >
                    {pending ? "Importing..." : "Confirm & Import"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
