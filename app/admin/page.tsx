import Link from "next/link";
import {
  countQuestions,
  getCourseStats,
  getSettings,
  listStudentsWithStats,
  listCourses,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const stats = await getCourseStats();
  const settings = await getSettings();
  const students = await listStudentsWithStats();
  const courses = await listCourses();

  const totalQuestions = stats.reduce((sum, s) => sum + s.questions, 0);

  // Total number of lessons with quiz across all courses
  const totalLessonsWithQuiz = stats.reduce((sum, s) => sum + s.lessons_with_quiz, 0);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          Admin panel
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          Dashboard admin
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Ringkasan bank soal dan performa peserta. Kelola soal lewat{" "}
          <Link href="/admin/soal" className="text-sky-400 underline">
            Bank Soal
          </Link>
          , pengaturan lewat{" "}
          <Link href="/admin/pengaturan" className="text-sky-400 underline">
            Pengaturan
          </Link>{" "}
          dan model AI tutor lewat{" "}
          <Link href="/admin/models" className="text-sky-400 underline">
            Model AI
          </Link>
          . Quiz dijalankan per lesson.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total bank soal", String(totalQuestions)],
          ["Lesson dengan quiz", `${totalLessonsWithQuiz}/${courses.length * 30}`], // rough estimate
          ["Kelulusan minimal", `${settings.quiz_pass_threshold || 70}%`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.07] bg-[#12181c] px-5 py-4"
          >
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Statistik per course</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#12181c]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Soal</th>
                <th className="px-4 py-3 font-medium">Lesson dengan quiz</th>
                <th className="px-4 py-3 font-medium">Pre-test</th>
                <th className="px-4 py-3 font-medium">Rata² pre</th>
                <th className="px-4 py-3 font-medium">Post-test</th>
                <th className="px-4 py-3 font-medium">Rata² post</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((course) => (
                <tr
                  key={course.slug}
                  className="border-b border-white/[0.05] last:border-0"
                >
                  <td className="px-4 py-3 text-white">{course.title}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {course.questions}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {course.lessons_with_quiz}/{course.lessons_total}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {course.pre_attempts}
                  </td>
                  <td className="px-4 py-3 font-mono text-sky-300">
                    {course.pre_avg ?? "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {course.post_attempts}
                  </td>
                  <td className="px-4 py-3 font-mono text-violet-300">
                    {course.post_avg ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Peserta</h2>
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Belum ada peserta. Peserta tercatat otomatis saat mengerjakan
            quiz.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#12181c]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Percobaan</th>
                  <th className="px-4 py-3 font-medium">Rata² pre</th>
                  <th className="px-4 py-3 font-medium">Rata² post</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-white/[0.05] last:border-0"
                  >
                    <td className="px-4 py-3 text-white">{student.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {student.attempts}
                    </td>
                    <td className="px-4 py-3 font-mono text-sky-300">
                      {student.pre_avg ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-violet-300">
                      {student.post_avg ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
