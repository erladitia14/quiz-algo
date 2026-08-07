import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourse,
  getSettings,
  listLessons,
  pickRandomQuestions,
} from "@/lib/db";

export const dynamic = "force-dynamic";

type ModuleGroup = {
  module_label: string;
  module_name: string;
  lessons: Array<{ lesson_number: number; title: string }>;
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();

  const lessons = listLessons(slug);
  const settings = getSettings();
  const availableQuestions = pickRandomQuestions(slug, 9999).length;

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
    group.lessons.push({
      lesson_number: lesson.lesson_number,
      title: lesson.title,
    });
  }

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
            ["Jumlah lesson", String(course.total_lessons)],
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

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/quiz/${slug}?type=pre`}
            className="inline-flex items-center rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Mulai Pre-Test ({settings.quiz_question_count || 10} soal acak)
          </Link>
          <Link
            href={`/quiz/${slug}?type=post`}
            className="inline-flex items-center rounded-lg border border-violet-400/40 bg-violet-500/10 px-5 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20"
          >
            Mulai Post-Test
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Kelulusan minimal {settings.quiz_pass_threshold || 70}%. Pre-test
          bebas diulang kapan saja; post-test idealnya dikerjakan setelah
          menyelesaikan semua materi.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold text-white">Silabus materi</h2>
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
              <ul className="mt-3 space-y-1.5">
                {module.lessons.map((lesson) => (
                  <li
                    key={lesson.lesson_number}
                    className="flex gap-2 text-sm text-slate-400"
                  >
                    <span className="w-8 shrink-0 font-mono text-xs text-slate-600">
                      {lesson.lesson_number}.
                    </span>
                    <span>{lesson.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
