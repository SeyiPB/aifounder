"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { resolveCurrentDay } from "@/lib/program";
import { awardPoints } from "@/app/dashboard/actions";
import { updatePointAward, deletePointAward } from "@/app/students/actions";
import { DEMO_DAY_RUBRIC, RUBRIC_SCALE, isDemoDayCategory } from "@/lib/rubric";
import type { Student, PointCategory, ProgramDay, PointAward } from "@/lib/types";

interface PointsManagementProps {
  initialStudents: Student[];
  initialCategories: PointCategory[];
  initialDays: ProgramDay[];
  initialAwards: PointAward[];
}

export function PointsManagement({
  initialStudents,
  initialCategories,
  initialDays,
  initialAwards,
}: PointsManagementProps) {
  const [students] = useState<Student[]>(initialStudents);
  const [categories] = useState<PointCategory[]>(initialCategories);
  const [days] = useState<ProgramDay[]>(initialDays);
  const [awards, setAwards] = useState<PointAward[]>(initialAwards);

  // Form states
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");
  const [pointsValue, setPointsValue] = useState<number>(0);
  const [awardNote, setAwardNote] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [confirmDupAward, setConfirmDupAward] = useState(false);

  // Filters state
  const [filterSearch, setFilterSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDay, setFilterDay] = useState("all");
  const [filterCohort, setFilterCohort] = useState("all");

  // Modals state
  const [editingAward, setEditingAward] = useState<PointAward | null>(null);
  const [deletingAward, setDeletingAward] = useState<PointAward | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  // Edit form states
  const [editPoints, setEditPoints] = useState(0);
  const [editNote, setEditNote] = useState("");
  const [editError, setEditError] = useState("");

  const [pending, startTransition] = useTransition();

  // Mappings
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const dayMap = useMemo(() => new Map(days.map((d) => [d.id, d])), [days]);

  // Set default day and category on load
  useEffect(() => {
    const current = resolveCurrentDay(days);
    if (current) {
      setSelectedDayId(current.id);
    } else if (days.length > 0) {
      setSelectedDayId(days[0].id);
    }

    if (categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
      setPointsValue(categories[0].points);
    }
  }, [days, categories]);

  // Handle category change in award form
  function handleCategoryChange(catId: string) {
    setSelectedCategoryId(catId);
    const cat = categoryMap.get(catId);
    if (cat) {
      setPointsValue(cat.points);
    }
  }

  // Student typeahead matches
  const studentMatches = useMemo(() => {
    if (!studentQuery.trim()) return [];
    const q = studentQuery.toLowerCase();
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [studentQuery, students]);

  // Filtered awards for table list
  const filteredAwards = useMemo(() => {
    return awards.filter((a) => {
      const student = studentMap.get(a.student_id);
      if (!student) return false;

      const matchesSearch =
        !filterSearch.trim() ||
        student.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (student.nickname &&
          student.nickname.toLowerCase().includes(filterSearch.toLowerCase()));

      const matchesCategory = filterCategory === "all" || a.category_id === filterCategory;
      const matchesDay = filterDay === "all" || a.day_id === filterDay;
      const matchesCohort =
        filterCohort === "all" || student.cohort_year.toString() === filterCohort;

      return matchesSearch && matchesCategory && matchesDay && matchesCohort;
    });
  }, [awards, filterSearch, filterCategory, filterDay, filterCohort, studentMap]);

  // Cohort list helper
  const cohortYearsList = useMemo(() => {
    const list = new Set(students.map((s) => s.cohort_year));
    return Array.from(list).sort((a, b) => b - a);
  }, [students]);

  // Categories valid for the selected day (day-gating, e.g. stand-up Days 17–20).
  const visibleCategories = useMemo(() => {
    const dayNumber = dayMap.get(selectedDayId)?.day_number;
    if (dayNumber == null) return categories;
    return categories.filter((c) => {
      if (c.min_day_number !== null && dayNumber < c.min_day_number) return false;
      if (c.max_day_number !== null && dayNumber > c.max_day_number) return false;
      return true;
    });
  }, [categories, dayMap, selectedDayId]);

  // If the selected category is hidden by the new day, fall back to the first valid one.
  useEffect(() => {
    if (visibleCategories.length === 0) return;
    if (!visibleCategories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(visibleCategories[0].id);
      setPointsValue(visibleCategories[0].points);
    }
  }, [visibleCategories, selectedCategoryId]);

  // Find category for validation inside award form
  const selectedCategory = useMemo(() => {
    return categoryMap.get(selectedCategoryId) || null;
  }, [selectedCategoryId, categoryMap]);

  // Reset the duplicate confirmation whenever the selection changes.
  useEffect(() => {
    setConfirmDupAward(false);
  }, [selectedStudent, selectedCategoryId, selectedDayId]);

  // Duplicate detection: same student + category + day already awarded.
  const isDuplicateAward = useMemo(() => {
    if (!selectedStudent || !selectedCategoryId || !selectedDayId) return false;
    return awards.some(
      (a) =>
        a.student_id === selectedStudent.id &&
        a.category_id === selectedCategoryId &&
        a.day_id === selectedDayId,
    );
  }, [awards, selectedStudent, selectedCategoryId, selectedDayId]);

  // Selected student point summary (for student modal)
  const studentPointsStats = useMemo(() => {
    if (!viewingStudent) return { total: 0, recent: [] as PointAward[] };

    const studentAwards = awards.filter((a) => a.student_id === viewingStudent.id);
    const total = studentAwards.reduce((sum, a) => sum + a.points_awarded, 0);
    const recent = studentAwards
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    return { total, recent };
  }, [viewingStudent, awards]);

  // Submit award form
  function handleAwardPoints(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!selectedStudent) {
      setFormError("Please select a student");
      return;
    }
    if (!selectedCategoryId) {
      setFormError("Please select a category");
      return;
    }
    if (selectedCategory?.requires_note && !awardNote.trim()) {
      setFormError("A note is required for this category");
      return;
    }
    // Duplicate warning: require a confirming second click.
    if (isDuplicateAward && !confirmDupAward) {
      setConfirmDupAward(true);
      return;
    }

    startTransition(async () => {
      const res = await awardPoints({
        studentId: selectedStudent.id,
        dayId: selectedDayId,
        categoryId: selectedCategoryId,
        points: pointsValue,
        note: awardNote,
      });

      if (res.ok) {
        setFormSuccess(`Successfully awarded points to ${selectedStudent.name}`);
        // Reset states
        setSelectedStudent(null);
        setStudentQuery("");
        setAwardNote("");
        setConfirmDupAward(false);
        if (categories.length > 0) {
          setSelectedCategoryId(categories[0].id);
          setPointsValue(categories[0].points);
        }
        // Force refresh local data
        window.location.reload();
      } else {
        setFormError(res.error || "Failed to award points");
      }
    });
  }

  // Edit / Delete submissions
  function openEditAwardModal(award: PointAward) {
    setEditingAward(award);
    setEditPoints(award.points_awarded);
    setEditNote(award.note || "");
    setEditError("");
  }

  const editingAwardCategory = useMemo(() => {
    if (!editingAward) return null;
    return categoryMap.get(editingAward.category_id) || null;
  }, [editingAward, categoryMap]);

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAward) return;
    if (editingAwardCategory?.requires_note && !editNote.trim()) {
      setEditError("A note is required for this category");
      return;
    }

    startTransition(async () => {
      const res = await updatePointAward(
        editingAward.id,
        editingAward.student_id,
        editPoints,
        editNote,
      );

      if (res.ok) {
        setEditingAward(null);
        window.location.reload();
      } else {
        setEditError(res.error || "Failed to update points award");
      }
    });
  }

  function handleDeleteAward() {
    if (!deletingAward) return;

    startTransition(async () => {
      const res = await deletePointAward(deletingAward.id, deletingAward.student_id);
      if (res.ok) {
        setDeletingAward(null);
        window.location.reload();
      } else {
        alert(res.error || "Failed to delete points award");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Points History & Adjustments</h1>
        <p className="text-sm text-slate-500">
          Award points to students manually, search history logs, and manage edits or deductions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2.2fr]">
        {/* COLUMN 1: AWARD POINTS FORM */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-fit">
          <h2 className="font-semibold text-navy mb-4">Award Points Form</h2>

          <form onSubmit={handleAwardPoints} className="space-y-4">
            {/* Student Search */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Student
              </label>
              {selectedStudent ? (
                <div className="flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2 border border-brand/20">
                  <span className="font-medium text-navy text-sm">
                    {selectedStudent.name}
                    {selectedStudent.nickname && ` (${selectedStudent.nickname})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="text-xs text-slate-500 hover:text-rose-600 font-semibold"
                  >
                    change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Search student by name..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  {studentMatches.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg text-sm">
                      {studentMatches.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(s);
                              setStudentQuery("");
                            }}
                            className="block w-full px-3 py-2 text-left hover:bg-slate-100 font-medium text-slate-700"
                          >
                            {s.name}
                            {s.nickname && ` (${s.nickname})`}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Category
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand"
              >
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Program Day selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Day
              </label>
              <select
                value={selectedDayId}
                onChange={(e) => setSelectedDayId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand"
              >
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    Day {d.day_number}: {d.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Points Value */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Points Awarded
              </label>
              <input
                type="number"
                value={pointsValue}
                onChange={(e) => setPointsValue(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              {selectedCategory?.min_points !== null && selectedCategory?.max_points !== null && (
                <span className="text-xs text-slate-400 mt-1 block">
                  Allowed range: {selectedCategory?.min_points} to {selectedCategory?.max_points} points
                </span>
              )}
            </div>

            {/* Demo Day rubric */}
            {selectedCategory && isDemoDayCategory(selectedCategory.name) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="mb-1 font-semibold">🚀 Demo Day rubric — 6 dimensions × 0–5 (max 30)</p>
                <ul className="space-y-0.5">
                  {DEMO_DAY_RUBRIC.map((d) => (
                    <li key={d.name}>
                      <span className="font-medium">{d.name}:</span> {d.measures}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-amber-700">{RUBRIC_SCALE}</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Note {selectedCategory?.requires_note && "(Required)"}
              </label>
              <input
                type="text"
                value={awardNote}
                onChange={(e) => setAwardNote(e.target.value)}
                placeholder="Facilitator notes explaining the points award..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </div>

            {formError && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                ⚠️ {formError}
              </div>
            )}

            {formSuccess && (
              <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700">
                ✓ {formSuccess}
              </div>
            )}

            {isDuplicateAward && (
              <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                ⚠️ {selectedStudent?.name} was already awarded{" "}
                {selectedCategory?.icon} {selectedCategory?.name} on this day.
                {confirmDupAward ? " Click again to confirm." : ""}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className={`w-full rounded-lg py-2.5 font-semibold text-white disabled:opacity-50 transition ${
                isDuplicateAward && confirmDupAward
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-navy hover:bg-navyhover"
              }`}
            >
              {pending
                ? "Saving..."
                : isDuplicateAward && confirmDupAward
                  ? "Confirm duplicate award"
                  : "Award points"}
            </button>
          </form>
        </section>

        {/* COLUMN 2: FILTERABLE HISTORY LOGS */}
        <section className="space-y-4">
          {/* Controls filters */}
          <div className="grid gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl sm:grid-cols-4 text-xs font-semibold">
            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-slate-400 uppercase tracking-wider">Search Student</label>
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Name or nickname..."
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:outline-none focus:border-brand"
              />
            </div>

            {/* Category dropdown */}
            <div className="space-y-1">
              <label className="text-slate-400 uppercase tracking-wider">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:border-brand"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Day dropdown */}
            <div className="space-y-1">
              <label className="text-slate-400 uppercase tracking-wider">Camp Day</label>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:border-brand"
              >
                <option value="all">All Program Days</option>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    Day {d.day_number}: {d.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Cohort filter */}
            <div className="space-y-1">
              <label className="text-slate-400 uppercase tracking-wider">Cohort</label>
              <select
                value={filterCohort}
                onChange={(e) => setFilterCohort(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:border-brand"
              >
                <option value="all">All Cohorts</option>
                {cohortYearsList.map((y) => (
                  <option key={y} value={y.toString()}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* History table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Day</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Points</th>
                  <th className="px-5 py-3">Note</th>
                  <th className="px-5 py-3">Awarded By</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAwards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                      No point awards found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredAwards.map((award) => {
                    const student = studentMap.get(award.student_id);
                    const day = dayMap.get(award.day_id);
                    const cat = categoryMap.get(award.category_id);
                    const points = award.points_awarded;

                    return (
                      <tr key={award.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setViewingStudent(student || null)}
                            className="font-semibold text-navy hover:underline text-left block"
                          >
                            {student?.name || "Deleted Student"}
                          </button>
                          {student?.nickname && (
                            <span className="rounded bg-slate-100 px-1 py-0.5 text-xxs text-slate-500 font-medium">
                              {student.nickname}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-700">
                          Day {day?.day_number || "?"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{cat?.icon}</span>
                            <span className="font-medium truncate max-w-xs">{cat?.name || "Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`font-bold ${
                              points >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {points >= 0 ? "+" : ""}
                            {points}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500 italic max-w-xs truncate">
                          {award.note || "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">
                          {award.awarded_by || "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => openEditAwardModal(award)}
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
        </section>
      </div>

      {/* MODAL 1: EDIT AWARD */}
      {editingAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-navy mb-1">Edit Point Award</h3>
            <p className="text-xs text-slate-500 mb-4">
              Student: {studentMap.get(editingAward.student_id)?.name} | Category:{" "}
              {editingAwardCategory?.name}
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Points
                </label>
                <input
                  type="number"
                  required
                  value={editPoints}
                  onChange={(e) => setEditPoints(Number(e.target.value))}
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
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              {editError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  ⚠️ {editError}
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
                  {pending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE AWARD */}
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
              from student <strong>{studentMap.get(deletingAward.student_id)?.name}</strong>?
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

      {/* MODAL 3: STUDENT SUMMARY QUICK VIEW */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-navy mb-1">{viewingStudent.name}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cohort Year: {viewingStudent.cohort_year}
              {viewingStudent.nickname && ` | Nickname: ${viewingStudent.nickname}`}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-5 border-t border-b border-slate-100 py-4">
              <div>
                <span className="text-xxs font-semibold uppercase tracking-wider text-slate-400 block">
                  Total Points
                </span>
                <span className="text-2xl font-bold text-slate-800">
                  🪙 {studentPointsStats.total} pts
                </span>
              </div>
              <div>
                <span className="text-xxs font-semibold uppercase tracking-wider text-slate-400 block">
                  Total Awards
                </span>
                <span className="text-2xl font-bold text-slate-800">
                  {awards.filter((a) => a.student_id === viewingStudent.id).length} times
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy mb-2">
                Recent 5 Point Awards
              </h4>
              <div className="overflow-x-auto max-h-48 overflow-y-auto border border-slate-150 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-slate-500">Day</th>
                      <th className="p-2 text-slate-500">Category</th>
                      <th className="p-2 text-slate-500">Points</th>
                      <th className="p-2 text-slate-500">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {studentPointsStats.recent.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-slate-450 italic">
                          No point history.
                        </td>
                      </tr>
                    ) : (
                      studentPointsStats.recent.map((rec) => {
                        const day = dayMap.get(rec.day_id);
                        const cat = categoryMap.get(rec.category_id);
                        return (
                          <tr key={rec.id}>
                            <td className="p-2 font-semibold text-slate-700">
                              D{day?.day_number || "?"}
                            </td>
                            <td className="p-2 font-medium text-slate-600">
                              {cat?.icon} {cat?.name}
                            </td>
                            <td className="p-2">
                              <span
                                className={`font-bold ${
                                  rec.points_awarded >= 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {rec.points_awarded >= 0 ? "+" : ""}
                                {rec.points_awarded}
                              </span>
                            </td>
                            <td className="p-2 text-slate-450 italic truncate max-w-xxs">
                              {rec.note || "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-2">
              <button
                onClick={() => setViewingStudent(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
