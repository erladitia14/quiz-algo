import Link from "next/link";
import { listAttempts, listCourses } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const attempts = await listAttempts();
  const courses = await listCourses();
  const titleBySlug = Object.fromEntries(
    courses.map((c) => [c.slug, c.title]),
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
          Riwayat
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          Semua percobaan quiz
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Klik baris untuk membuka pembahasan lengkap. Bandingkan pre-test dan
          post-test per siswa untuk melihat perkembangan.
        </p>
      </header>

      {attempts.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#12181c] p-10 text-center">
          <p className="text-slate-400">Belum ada quiz yang dikerjakan.</p>
          <Link
            href="/courses"
            className="mt-4 inline-flex rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Mulai quiz pertama
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#12181c]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-medium">Peserta</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Benar</th>
                <th className="px-4 py-3 font-medium">Nilai</th>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr
                  key={attempt.id}
                  className="border-b border-white/[0.05] last:border-0"
                >
                  <td className="px-4 py-3 text-white">{attempt.student_name}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {titleBySlug[attempt.course_slug] || attempt.course_slug}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        attempt.quiz_type === "pre"
                          ? "bg-sky-400/15 text-sky-300"
                          : "bg-violet-400/15 text-violet-300"
                      }`}
                    >
                      {attempt.quiz_type === "pre" ? "Pre-Test" : "Post-Test"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {attempt.correct_count}/{attempt.total_questions}
                  </td>
                  <td
                    className={`px-4 py-3 font-mono font-semibold ${
                      attempt.score >= 70 ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {attempt.score}%
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {attempt.submitted_at || "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/hasil/${attempt.id}`}
                      className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      Pembahasan
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
