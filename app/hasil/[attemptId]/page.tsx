import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttempt, getAttemptAnswers } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const attempt = await getAttempt(parseInt(attemptId, 10));
  if (!attempt) notFound();

  const answers = await getAttemptAnswers(attempt.id);
  const threshold = 70;
  const passed = attempt.score >= threshold;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="rounded-2xl border border-white/[0.08] bg-[#12181c] p-6 text-center sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
          Hasil {attempt.quiz_type === "pre" ? "Pre-Test" : "Post-Test"} ·{" "}
          {attempt.course_slug}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          {attempt.student_name}
        </h1>
        <p
          className={`mt-4 text-6xl font-bold ${passed ? "text-emerald-400" : "text-rose-400"}`}
        >
          {attempt.score}%
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Benar {attempt.correct_count} dari {attempt.total_questions} soal ·
          dikumpulkan {attempt.submitted_at}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {attempt.lesson_id ? (
            <>
              <Link
                href={`/quiz/${attempt.lesson_id}?type=${attempt.quiz_type}`}
                className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
              >
                Ulangi quiz lesson ini
              </Link>
              <Link
                href={`/courses/${attempt.course_slug}#lesson-${attempt.lesson_id}`}
                className="rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
              >
                Ke course
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/quiz/${attempt.course_slug}?type=${attempt.quiz_type}`}
                className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
              >
                Ulangi quiz
              </Link>
              <Link
                href={`/courses/${attempt.course_slug}`}
                className="rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
              >
                Ke course
              </Link>
            </>
          )}
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-white">
          Pembahasan jawaban
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          {answers.map((answer, index) => {
            const options = JSON.parse(answer.options) as string[];
            const correct = answer.is_correct === 1;
            return (
              <div
                key={answer.id}
                className={`rounded-xl border p-5 ${
                  correct
                    ? "border-emerald-400/25 bg-emerald-400/[0.04]"
                    : "border-rose-400/25 bg-rose-400/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-white">
                    {index + 1}. {answer.question}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      correct
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-rose-400/15 text-rose-300"
                    }`}
                  >
                    {correct ? "BENAR" : "SALAH"}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-slate-500">
                  {answer.module_ref}
                  {answer.lesson_ref ? ` · ${answer.lesson_ref}` : ""}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {options.map((option, optionIndex) => {
                    const isCorrectOption =
                      optionIndex === answer.correct_index;
                    const isSelected = optionIndex === answer.selected_index;
                    let style = "text-slate-400";
                    if (isCorrectOption) style = "text-emerald-300 font-medium";
                    else if (isSelected) style = "text-rose-300";
                    return (
                      <li key={optionIndex} className={`text-sm ${style}`}>
                        {String.fromCharCode(65 + optionIndex)}. {option}
                        {isCorrectOption ? " ✓" : ""}
                        {isSelected && !isCorrectOption ? " ✗ (pilihanmu)" : ""}
                      </li>
                    );
                  })}
                </ul>
                {answer.explanation ? (
                  <p className="mt-3 rounded-lg bg-black/25 px-3 py-2.5 text-xs leading-5 text-slate-300">
                    💡 {answer.explanation}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
