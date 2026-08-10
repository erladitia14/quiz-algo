import Link from "next/link";
import { getCourseStats, getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const stats = await getCourseStats();
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
          Katalog quiz
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          Kursus Python &amp; Visual Programming
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Pilih course untuk melihat silabus dan memulai pre-test. Setiap quiz
          mengambil {settings.quiz_question_count || 10} soal acak dari bank
          soal, dengan batas kelulusan {settings.quiz_pass_threshold || 70}%.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {stats.map((course) => (
          <Link
            key={course.slug}
            href={`/courses/${course.slug}`}
            className="group rounded-xl border border-white/[0.08] bg-[#12181c] p-6 transition hover:border-sky-400/40 hover:bg-sky-400/[0.04]"
          >
            <h2 className="text-lg font-semibold text-white group-hover:text-sky-300">
              {course.title}
            </h2>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {course.slug}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-black/25 px-2 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                  Bank soal
                </dt>
                <dd className="mt-1 text-xl font-semibold text-white">
                  {course.questions}
                </dd>
              </div>
              <div className="rounded-lg bg-black/25 px-2 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                  Pre-test
                </dt>
                <dd className="mt-1 text-xl font-semibold text-sky-300">
                  {course.pre_attempts}
                </dd>
              </div>
              <div className="rounded-lg bg-black/25 px-2 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                  Post-test
                </dt>
                <dd className="mt-1 text-xl font-semibold text-violet-300">
                  {course.post_attempts}
                </dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </div>
  );
}
