import Link from "next/link";
import { notFound } from "next/navigation";
import {
  countQuestions,
  getCourse,
  getLessonQuestionCounts,
  getLessonQuizStats,
  getSettings,
  listLessons,
} from "@/lib/db";

export const dynamic = "force-dynamic";

type ModuleGroup = {
  module_label: string;
  module_name: string;
  lessons: Array<{
    id: number;
    lesson_number: number;
    title: string;
    question_count: number;
    pre_attempts: number;
    pre_avg: number | null;
    post_attempts: number;
    post_avg: number | null;
  }>;
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const lessons = await listLessons(slug);
  const settings = await getSettings();
  const availableQuestions = await countQuestions(slug);
  const questionCounts = await getLessonQuestionCounts(slug);
  const quizStats = await getLessonQuizStats(slug);

  const modules: ModuleGroup[] = [];
  for (const lesson of lessons) {
    const key = lesson.module_label;
    let group = modules.find((m) => m.module_label === key);
    if (!group) {
      group = {
        module_label: lesson.module_label,
        module_name: lesson.module_name,
        lessons: [],
      };
      modules.push(group);
    }
    const stat = quizStats.get(lesson.id);
    group.lessons.push({
      id: lesson.id,
      lesson_number: lesson.lesson_number,
      title: lesson.title,
      question_count: questionCounts.get(lesson.id) || 0,
      pre_attempts: stat?.pre_attempts ?? 0,
      pre_avg: stat?.pre_avg ?? null,
      post_attempts: stat?.post_attempts ?? 0,
      post_avg: stat?.post_avg ?? null,
    });
  }

  const lessonsWithQuiz = lessons.filter(
    (l) => (questionCounts.get(l.id) || 0) > 0,
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="rounded-2xl border border-white/[0.08] bg-[#12181c] p-6 sm:p-8">
        <nav className="text-xs text-slate-500">
          <Link href="/courses" className="hover:text-slate-300">
            ← Semua kursus
          </Link>
        </nav>
        <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
          {course.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          {course.description}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Track", course.track],
            ["Lesson dengan quiz", `${lessonsWithQuiz}/${lessons.length}`],
            ["Modul", String(modules.length)],
            ["Bank soal", `${availableQuestions} soal`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5"
            >
              <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                {label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Quiz dikerjakan <span className="text-slate-300">per lesson</span>:
          kerjakan pre-test sebelum mempelajari materi lesson, lalu post-test
          setelah selesai. Batas kelulusan{" "}
          {settings.quiz_pass_threshold || 70}% — keduanya bisa diulang kapan
          saja.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold text-white">
          Silabus &amp; quiz per lesson
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Soal quiz diambil dari materi lesson berikut (PDF resmi kurikulum).
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {modules.map((module) => (
            <div
              key={module.module_label}
              className="rounded-xl border border-white/[0.08] bg-[#12181c] p-5"
            >
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-sky-400">
                {module.module_label}
              </p>
              <h3 className="mt-1 font-semibold text-white">
                {module.module_name}
              </h3>
              <ul className="mt-3 space-y-2">
                {module.lessons.map((lesson) => {
                  const hasQuiz = lesson.question_count > 0;
                  return (
                    <li
                      key={lesson.id}
                      className={`rounded-lg border px-3 py-2.5 ${
                        hasQuiz
                          ? "border-white/[0.07] bg-black/20"
                          : "border-white/[0.04] bg-transparent opacity-60"
                      }`}
                      id={`lesson-${lesson.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-slate-300">
                          <span className="mr-2 font-mono text-xs text-slate-600">
                            {lesson.lesson_number}.
                          </span>
                          {lesson.title}
                        </p>
                        {hasQuiz ? (
                          <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            {lesson.question_count} soal
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] text-slate-600">
                            belum ada quiz
                          </span>
                        )}
                      </div>
                      {hasQuiz ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Link
                            href={`/quiz/${lesson.id}?type=pre`}
                            className="rounded-md bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-300 transition hover:bg-sky-500/25"
                          >
                            Pre-Test
                          </Link>
                          <Link
                            href={`/quiz/${lesson.id}?type=post`}
                            className="rounded-md bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-500/25"
                          >
                            Post-Test
                          </Link>
                          <span className="text-[10px] text-slate-500">
                            {lesson.pre_attempts > 0 && (
                              <>
                                pre {lesson.pre_attempts}x
                                {lesson.pre_avg != null
                                  ? ` (rata-rata ${lesson.pre_avg})`
                                  : ""}
                                {" · "}
                              </>
                            )}
                            {lesson.post_attempts > 0 ? (
                              <>
                                post {lesson.post_attempts}x
                                {lesson.post_avg != null
                                  ? ` (rata-rata ${lesson.post_avg})`
                                  : ""}
                              </>
                            ) : lesson.pre_attempts === 0 ? (
                              "belum dikerjakan"
                            ) : null}
                          </span>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
