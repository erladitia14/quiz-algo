"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
};

type LessonData = {
  lesson_number: number;
  title: string;
  module_label: string;
  module_name: string;
};

type QuizData = {
  course: { slug: string };
  lesson: LessonData;
  type: "pre" | "post";
  passThreshold: number;
  timerMinutes: number;
  questions: QuizQuestion[];
};

type SubmitResponse = {
  ok: boolean;
  attemptId?: number;
  score?: number;
  correctCount?: number;
  totalQuestions?: number;
  message?: string;
};

export default function QuizPage() {
  const params = useParams<{ lessonId: string }>();
  const searchParams = useSearchParams();
  const lessonIdRaw = Number(params.lessonId);
  const quizType = searchParams.get("type") === "post" ? "post" : "pre";

  const [phase, setPhase] = useState<"intro" | "quiz" | "submitting" | "done">(
    "intro",
  );
  const [data, setData] = useState<QuizData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [studentName, setStudentName] = useState("");
  const [nameError, setNameError] = useState("");
  const [startedAt, setStartedAt] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<SubmitResponse | null>(null);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const loadQuiz = useCallback(async () => {
    if (lessonIdRaw <= 0) return;
    setLoadError("");
    try {
      const response = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lessonIdRaw, type: quizType }),
      });
      const payload = (await response.json()) as QuizData & {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Gagal memuat quiz.");
      }
      setData(payload);
      if (quizType === "post" && payload.timerMinutes > 0) {
        setSecondsLeft(payload.timerMinutes * 60);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Gagal memuat quiz.",
      );
    }
  }, [lessonIdRaw, quizType]);

  useEffect(() => {
    void loadQuiz();
  }, [loadQuiz]);

  // Timer post-test
  useEffect(() => {
    if (phase !== "quiz" || secondsLeft === null) return;
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, secondsLeft]);

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = data?.questions.length || 0;
  const current = data?.questions[currentIndex];

  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;

  const timerLabel = useMemo(() => {
    if (secondsLeft === null) return null;
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [secondsLeft]);

  const submit = useCallback(async () => {
    if (!data || phase === "submitting") return;
    setPhase("submitting");
    setSubmitError("");
    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lessonIdRaw,
          quizType,
          studentName,
          startedAt,
          answers: data.questions.map((q) => ({
            questionId: q.id,
            selectedIndex: answers[q.id] ?? -1,
          })),
        }),
      });
      const payload = (await response.json()) as SubmitResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Gagal menyimpan jawaban.");
      }
      setResult(payload);
      setPhase("done");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Gagal menyimpan jawaban.",
      );
      setPhase("quiz");
    }
  }, [answers, data, nameError, phase, quizType, startedAt, studentName, lessonIdRaw]);

  // Auto-submit saat timer habis
  useEffect(() => {
    if (phase === "quiz" && secondsLeft === 0) {
      void submit();
    }
  }, [phase, secondsLeft, submit]);

  const startQuiz = () => {
    if (!studentName.trim()) {
      setNameError("Isi dulu nama kamu untuk mulai.");
      return;
    }
    setNameError("");
    setStartedAt(new Date().toISOString());
    setAnswers({});
    setCurrentIndex(0);
    setPhase("quiz");
  };

  if (phase === "done" && result && data) {
    const passed = (result.score || 0) >= data.passThreshold;
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-[#12181c] p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
          {quizType === "pre" ? "Pre-Test" : "Post-Test"} ·{" "}
          {data.lesson.module_name} · {data.lesson.title}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          {passed ? "Selamat, kamu lulus! 🎉" : "Belum mencapai batas kelulusan"}
        </h1>
        <p
          className={`mt-6 text-6xl font-bold ${
            passed ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {result.score}%
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Benar {result.correctCount} dari {result.totalQuestions} soal ·
          batas kelulusan {data.passThreshold}%
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/hasil/${result.attemptId}`}
            className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Lihat pembahasan jawaban
          </Link>
          <Link
            href={`/courses/${data.course.slug}`}
            className="rounded-lg border border-white/[0.12] px-5 py-3 text-sm text-slate-300 hover:bg-white/[0.06]"
          >
            Kembali ke course
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-[#12181c] p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
          {quizType === "pre" ? "Pre-Test" : "Post-Test"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {data ? `${data.lesson.module_name}: ${data.lesson.title}` : "Memuat lesson..."}
        </h1>
        {loadError ? (
          <div className="mt-6 rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {loadError}
          </div>
        ) : (
          <>
            <ul className="mt-5 space-y-2 text-sm text-slate-400">
              <li>
                • {data ? data.questions.length : "..."} soal pilihan ganda
                (semua soal dari lesson ini)
              </li>
              <li>• Batas kelulusan: {data ? data.passThreshold : "..."}%</li>
              {quizType === "post" && data && data.timerMinutes > 0 ? (
                <li>• Ada batas waktu {data.timerMinutes} menit</li>
              ) : (
                <li>• Tidak ada batas waktu — kerjakan dengan tenang</li>
              )}
              <li>• Quiz bisa diulang kapan saja</li>
            </ul>
            <label className="mt-6 block">
              <span className="mb-2 block text-sm text-slate-300">
                Nama peserta
              </span>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Contoh: Erlangga Aditia"
                className="w-full rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-3 text-sm text-white placeholder:text-slate-600 focus:border-sky-400 focus:outline-none"
              />
            </label>
            {nameError ? (
              <p className="mt-2 text-sm text-rose-300">{nameError}</p>
            ) : null}
            <button
              type="button"
              onClick={startQuiz}
              disabled={!data}
              className="mt-6 w-full rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
            >
              Mulai quiz sekarang
            </button>
          </>
        )}
      </div>
    );
  }

  if (!data || !current) {
    return (
      <div className="text-center text-sm text-slate-400">Memuat quiz...</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between text-sm">
        <p className="text-slate-400">
          {data.lesson.module_name} · {quizType === "pre" ? "Pre-Test" : "Post-Test"}
        </p>
        <div className="flex items-center gap-3">
          {timerLabel ? (
            <span
              className={`rounded-lg px-3 py-1.5 font-mono text-sm ${
                secondsLeft !== null && secondsLeft < 60
                  ? "bg-rose-500/15 text-rose-300"
                  : "bg-white/[0.06] text-slate-300"
              }`}
            >
              ⏱ {timerLabel}
            </span>
          ) : null}
          <span className="font-mono text-slate-500">
            {currentIndex + 1}/{totalQuestions}
          </span>
        </div>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#12181c] p-6 sm:p-8">
        <p className="font-mono text-xs text-slate-500">
          {data.lesson.module_label}
          <br />
          {data.lesson.title}
        </p>
        <h2 className="mt-3 text-lg font-medium leading-7 text-white sm:text-xl">
          {current.question}
        </h2>
        <div className="mt-6 flex flex-col gap-3">
          {current.options.map((option, index) => {
            const selected = answers[current.id] === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() =>
                  setAnswers((prev) => ({ ...prev, [current.id]: index }))
                }
                className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition ${
                  selected
                    ? "border-sky-400/60 bg-sky-400/10 text-white"
                    : "border-white/[0.09] bg-black/20 text-slate-300 hover:border-white/[0.2] hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    selected
                      ? "border-sky-400 bg-sky-500 text-slate-950"
                      : "border-white/[0.15] text-slate-500"
                  }`}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-40"
        >
          ← Sebelumnya
        </button>
        <p className="text-xs text-slate-500">
          Terjawab {answeredCount}/{totalQuestions}
        </p>
        {currentIndex < totalQuestions - 1 ? (
          <button
            type="button"
            onClick={() =>
              setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))
            }
            className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Berikutnya →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!allAnswered || phase === "submitting"}
            className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
          >
            {phase === "submitting" ? "Menyimpan..." : "Kumpulkan jawaban"}
          </button>
        )}
      </div>

      {submitError ? (
        <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {submitError}
        </p>
      ) : null}
      {!allAnswered && currentIndex === totalQuestions - 1 ? (
        <p className="mt-3 text-center text-xs text-slate-500">
          Jawab semua soal dulu untuk bisa mengumpulkan.
        </p>
      ) : null}
    </div>
  );
}
