"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type QuestionRow = {
  id: number;
  course_slug: string;
  lesson_ref: string;
  module_ref: string;
  question: string;
  options: string;
  correct_index: number;
  explanation: string;
  difficulty: string;
  active: number;
};

type CourseOption = { slug: string; title: string };

export default function AdminQuestionsPage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [courseFilter, setCourseFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    course_slug: "",
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correct_index: 0,
    explanation: "",
    module_ref: "",
    lesson_ref: "",
    difficulty: "easy",
  });
  const [saving, setSaving] = useState(false);

  const loadCourses = useCallback(async () => {
    try {
      const response = await fetch("/api/courses");
      const payload = await response.json();
      if (payload.ok) {
        setCourses(
          payload.courses.map((c: { slug: string; title: string }) => ({
            slug: c.slug,
            title: c.title,
          })),
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const loadQuestions = useCallback(async () => {
    try {
      const url = courseFilter
        ? `/api/admin/questions?course=${encodeURIComponent(courseFilter)}`
        : "/api/admin/questions";
      const response = await fetch(url);
      const payload = await response.json();
      if (payload.ok) setQuestions(payload.questions || []);
    } catch {
      setError("Gagal memuat soal.");
    }
  }, [courseFilter]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const addQuestion = async () => {
    setError("");
    setNotice("");
    const options = [form.optionA, form.optionB, form.optionC, form.optionD]
      .map((o) => o.trim())
      .filter(Boolean);
    if (!form.course_slug || !form.question.trim() || options.length < 2) {
      setError("Isi course, pertanyaan, dan minimal 2 opsi jawaban.");
      return;
    }
    if (form.correct_index >= options.length) {
      setError("Indeks jawaban benar tidak valid untuk jumlah opsi yang diisi.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_slug: form.course_slug,
          question: form.question,
          options,
          correct_index: form.correct_index,
          explanation: form.explanation,
          module_ref: form.module_ref,
          lesson_ref: form.lesson_ref,
          difficulty: form.difficulty,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Gagal menambah soal.");
      }
      setNotice("Soal berhasil ditambahkan.");
      setForm((prev) => ({
        ...prev,
        question: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        explanation: "",
      }));
      void loadQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah soal.");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (id: number) => {
    if (!window.confirm("Hapus soal ini?")) return;
    try {
      const response = await fetch(`/api/admin/questions/${id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.message);
      setNotice("Soal dihapus.");
      void loadQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus soal.");
    }
  };

  const toggleActive = async (row: QuestionRow) => {
    try {
      const response = await fetch(`/api/admin/questions/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: row.active ? 0 : 1 }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.message);
      void loadQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah status soal.");
    }
  };

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) {
      map.set(q.course_slug, (map.get(q.course_slug) || 0) + 1);
    }
    return map;
  }, [questions]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          Admin · Bank soal
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Kelola soal quiz
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Tambah, nonaktifkan, atau hapus soal per course.{" "}
          <Link href="/admin" className="text-sky-400 underline">
            ← Kembali ke dashboard
          </Link>
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </p>
      ) : null}

      <section className="rounded-xl border border-white/[0.08] bg-[#12181c] p-6">
        <h2 className="text-lg font-semibold text-white">Tambah soal baru</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">
              Course
            </span>
            <select
              value={form.course_slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, course_slug: e.target.value }))
              }
              className="w-full rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-2.5 text-sm text-white"
            >
              <option value="">— pilih course —</option>
              {courses.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">
              Modul (opsional)
            </span>
            <input
              value={form.module_ref}
              onChange={(e) =>
                setForm((f) => ({ ...f, module_ref: e.target.value }))
              }
              placeholder="Modul 1"
              className="w-full rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-2.5 text-sm text-white"
            />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">
            Pertanyaan
          </span>
          <textarea
            value={form.question}
            onChange={(e) =>
              setForm((f) => ({ ...f, question: e.target.value }))
            }
            rows={2}
            className="w-full rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-2.5 text-sm text-white"
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["optionA", "optionB", "optionC", "optionD"] as const).map(
            (key, index) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct_index"
                  checked={form.correct_index === index}
                  onChange={() =>
                    setForm((f) => ({ ...f, correct_index: index }))
                  }
                  className="h-4 w-4 accent-emerald-400"
                />
                <input
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  placeholder={`Pilihan ${String.fromCharCode(65 + index)}`}
                  className="w-full rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-2.5 text-sm text-white"
                />
              </label>
            ),
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tandai radio pada opsi yang menjadi jawaban benar.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">
            Penjelasan (opsional)
          </span>
          <textarea
            value={form.explanation}
            onChange={(e) =>
              setForm((f) => ({ ...f, explanation: e.target.value }))
            }
            rows={2}
            className="w-full rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-2.5 text-sm text-white"
          />
        </label>
        <button
          type="button"
          onClick={() => void addQuestion()}
          disabled={saving}
          className="mt-5 rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan soal"}
        </button>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            Daftar soal ({questions.length})
          </h2>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-2 text-sm text-white"
          >
            <option value="">Semua course</option>
            {courses.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title} ({counts.get(c.slug) || 0})
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {questions.map((q) => {
            const options = JSON.parse(q.options) as string[];
            return (
              <div
                key={q.id}
                className={`rounded-xl border p-4 ${
                  q.active
                    ? "border-white/[0.08] bg-[#12181c]"
                    : "border-white/[0.05] bg-black/20 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-slate-500">
                      {q.course_slug} · {q.module_ref} · {q.lesson_ref} ·{" "}
                      {q.difficulty}
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {q.question}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                      {options.map((option, i) => (
                        <li
                          key={i}
                          className={
                            i === q.correct_index
                              ? "text-emerald-300"
                              : undefined
                          }
                        >
                          {String.fromCharCode(65 + i)}. {option}
                          {i === q.correct_index ? " ✓" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleActive(q)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        q.active
                          ? "border-amber-400/40 text-amber-300 hover:bg-amber-400/10"
                          : "border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10"
                      }`}
                    >
                      {q.active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteQuestion(q.id)}
                      className="rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-400/10"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
