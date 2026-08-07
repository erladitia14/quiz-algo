/**
 * Sinkronisasi data course + lesson dari DB ops-edu (algonova.db) ke quiz.db.
 * Bersifat idempotent — aman dijalankan berulang.
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const OPS_EDU_DB =
  process.env.OPS_EDU_DB_PATH ||
  path.join(root, "..", "SaaS", "data", "algonova.db");
const QUIZ_DB = path.join(root, "data", "quiz.db");

const targetCourses = [
  "python-start-1st-year",
  "python-start-2nd-year",
  "python-pro-2nd-year",
  "visual-programming",
];

const src = new Database(OPS_EDU_DB, { readonly: true });
const dst = new Database(QUIZ_DB);
dst.pragma("foreign_keys = ON");

let courseCount = 0;
let lessonCount = 0;

for (const slug of targetCourses) {
  const course = src
    .prepare(
      "SELECT slug, judul, modul, deskripsi, total_lesson, aktif FROM algonova_courses WHERE slug = ?",
    )
    .get(slug);
  if (!course) {
    console.warn(`Course not found in ops-edu DB: ${slug}`);
    continue;
  }

  dst.prepare(
    `INSERT INTO courses (slug, title, track, description, total_lessons, active)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       title = excluded.title,
       track = excluded.track,
       description = excluded.description,
       total_lessons = excluded.total_lessons,
       active = excluded.active,
       updated_at = datetime('now')`,
  ).run(
    course.slug,
    course.judul,
    course.modul,
    course.deskripsi,
    course.total_lesson,
    course.aktif,
  );
  courseCount++;

  const lessons = src
    .prepare(
      `SELECT cl.nomor_pelajaran, cl.modul, cl.nama_modul, cl.judul, cl.pdf_path
       FROM algonova_course_lessons cl
       JOIN algonova_courses co ON cl.course_id = co.id
       WHERE co.slug = ?
       ORDER BY cl.nomor_pelajaran`,
    )
    .all(slug);

  dst.prepare("DELETE FROM lessons WHERE course_slug = ?").run(slug);
  const insertLesson = dst.prepare(
    `INSERT INTO lessons (course_slug, lesson_number, module_label, module_name, title, pdf_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const l of lessons) {
    insertLesson.run(
      slug,
      l.nomor_pelajaran,
      l.modul || "",
      l.nama_modul || "",
      l.judul,
      l.pdf_path || "",
    );
    lessonCount++;
  }
}

const coursesInDb = dst.prepare("SELECT COUNT(*) c FROM courses").get().c;
const lessonsInDb = dst.prepare("SELECT COUNT(*) c FROM lessons").get().c;

src.close();
dst.close();

console.log(`Synced ${courseCount} courses (${lessonCount} lessons processed)`);
console.log(`DB totals: ${coursesInDb} courses, ${lessonsInDb} lessons`);
