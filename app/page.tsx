import Link from "next/link";
import {
  getCourseStats,
  getSettings,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const stats = getCourseStats() as Array<{
    slug: string;
    title: string;
    questions: number;
    pre_attempts: number;
    pre_avg: number | null;
    post_attempts: number;
    post_avg: number | null;
  }>;
  const settings = getSettings();

  const totalQuestions = stats.reduce((sum, s) => sum + s.questions, 0);
  const totalAttempts = stats.reduce(
    (sum, s) => sum + s.pre_attempts + s.post_attempts,
    0,
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.05] p-8 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
          Algonova · Quiz Platform
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Pre-test &amp; post-test untuk course Python dan Visual Programming
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Soal disusun langsung dari materi pelajaran LMS Algonova. Kerjakan
          pre-test sebelum mulai belajar, lalu post-test setelah semua materi
          selesai untuk mengukur perkembanganmu.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/courses"
            className="inline-flex items-center rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Mulai kerjakan quiz
          </Link>
          <Link
            href="/riwayat"
            className="inline-flex items-center rounded-lg border border-white/[0.12] px-5 py-3 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            Lihat riwayat nilai
          </Link>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Kursus aktif", String(stats.length)],
            ["Soal tersedia", String(totalQuestions)],
            ["Quiz dikerjakan", String(totalAttempts)],
            ["Kelulusan minimal", `${settings.quiz_pass_threshold || 70}%`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3"
            >
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">
                {label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Kursus tersedia</h2>
        <p className="mt-1 text-sm text-slate-400">
          {stats.length} course dengan bank soal berbasis materi resmi.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {stats.map((course) => (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}`}
              className="group rounded-xl border border-white/[0.08] bg-[#12181c] p-5 transition hover:border-sky-400/40 hover:bg-sky-400/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-white group-hover:text-sky-300">
                  {course.title}
                </h3>
                <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                  {course.questions} soal
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Pre-test: {course.pre_attempts} percobaan
                {course.pre_avg != null ? ` · rata-rata ${course.pre_avg}` : ""}
                {" · "}
                Post-test: {course.post_attempts} percobaan
                {course.post_avg != null
                  ? ` · rata-rata ${course.post_avg}`
                  : ""}
              </p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-300">
                  Pre-Test →
                </span>
                <span className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300">
                  Post-Test
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
