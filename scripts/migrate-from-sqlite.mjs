/**
 * Migrasi data dari SQLite lokal (data/quiz.db) ke PostgreSQL.
 * Idempotent: memakai ON CONFLICT DO NOTHING / skip-if-exists sehingga aman
 * dijalankan berulang. Urutan insert mengikuti dependensi foreign key.
 *
 * Pemakaian: node scripts/migrate-from-sqlite.mjs [--sqlite <path>]
 * (DATABASE_URL diambil dari environment atau .env.local)
 */
import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvFile(name) {
  const file = path.join(root, name);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.production");

const args = process.argv.slice(2);
const sqliteArgIndex = args.indexOf("--sqlite");
const sqlitePath =
  sqliteArgIndex >= 0 && args[sqliteArgIndex + 1]
    ? args[sqliteArgIndex + 1]
    : path.join(root, "data", "quiz.db");

if (!existsSync(sqlitePath)) {
  console.error(`File SQLite tidak ditemukan: ${sqlitePath}`);
  process.exit(1);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL belum diset.");
  process.exit(1);
}

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const pool = new pg.Pool({
  connectionString,
  ssl: /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
});
const client = await pool.connect();

const counts = {};

try {
  await client.query("BEGIN");

  // 1. courses
  const courses = sqlite.prepare("SELECT * FROM courses ORDER BY id").all();
  for (const c of courses) {
    await client.query(
      `INSERT INTO courses (slug, title, track, description, total_lessons, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO NOTHING`,
      [
        c.slug,
        c.title,
        c.track,
        c.description ?? "",
        c.total_lessons ?? 0,
        c.active ?? 1,
        c.created_at ?? "",
        c.updated_at ?? "",
      ],
    );
  }
  counts.courses = courses.length;

  // 2. lessons (tidak ada unique constraint alami — cek manual per baris)
  const lessons = sqlite.prepare("SELECT * FROM lessons ORDER BY id").all();
  for (const l of lessons) {
    const exists = await client.query(
      "SELECT 1 FROM lessons WHERE course_slug = $1 AND lesson_number = $2 AND title = $3",
      [l.course_slug, l.lesson_number, l.title],
    );
    if (exists.rowCount > 0) continue;
    await client.query(
      `INSERT INTO lessons (course_slug, lesson_number, module_label, module_name, title, pdf_path, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        l.course_slug,
        l.lesson_number,
        l.module_label ?? "",
        l.module_name ?? "",
        l.title,
        l.pdf_path ?? "",
        l.active ?? 1,
        l.created_at ?? "",
      ],
    );
  }
  counts.lessons = lessons.length;

  // 3. students
  const students = sqlite.prepare("SELECT * FROM students ORDER BY id").all();
  for (const s of students) {
    const existing = await client.query(
      "SELECT id FROM students WHERE lower(name) = lower($1)",
      [s.name],
    );
    if (existing.rowCount > 0) continue;
    await client.query(
      `INSERT INTO students (name, email, phone, external_ref, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [s.name, s.email ?? "", s.phone ?? "", s.external_ref ?? "", s.created_at ?? ""],
    );
  }
  counts.students = students.length;

  // 4. questions — id asli dipertahankan supaya attempt_answers lama tetap valid.
  const questions = sqlite.prepare("SELECT * FROM questions ORDER BY id").all();
  for (const q of questions) {
    const exists = await client.query("SELECT 1 FROM questions WHERE id = $1", [q.id]);
    if (exists.rowCount > 0) continue;
    await client.query(
      `INSERT INTO questions (id, course_slug, lesson_ref, module_ref, question, options, correct_index, explanation, difficulty, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        q.id,
        q.course_slug,
        q.lesson_ref ?? "",
        q.module_ref ?? "",
        q.question,
        q.options,
        q.correct_index,
        q.explanation ?? "",
        q.difficulty ?? "easy",
        q.active ?? 1,
        q.created_at ?? "",
      ],
    );
  }
  if (questions.length > 0) {
    const maxId = Math.max(...questions.map((q) => q.id));
    await client.query(`SELECT setval(pg_get_serial_sequence('questions', 'id'), ${maxId}, true)`);
  }
  counts.questions = questions.length;

  // 5. quiz_attempts — id asli dipertahankan, map student_id SQLite → Postgres by name.
  const attempts = sqlite.prepare("SELECT * FROM quiz_attempts ORDER BY id").all();
  for (const a of attempts) {
    const exists = await client.query("SELECT 1 FROM quiz_attempts WHERE id = $1", [a.id]);
    if (exists.rowCount > 0) continue;
    let pgStudentId = null;
    if (a.student_name) {
      const found = await client.query(
        "SELECT id FROM students WHERE lower(name) = lower($1) LIMIT 1",
        [a.student_name],
      );
      pgStudentId = found.rowCount > 0 ? found.rows[0].id : null;
    }
    await client.query(
      `INSERT INTO quiz_attempts (id, student_id, student_name, course_slug, quiz_type, total_questions, correct_count, score, started_at, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        a.id,
        pgStudentId,
        a.student_name,
        a.course_slug,
        a.quiz_type,
        a.total_questions,
        a.correct_count ?? 0,
        a.score ?? 0,
        a.started_at,
        a.submitted_at ?? null,
      ],
    );
  }
  if (attempts.length > 0) {
    const maxId = Math.max(...attempts.map((a) => a.id));
    await client.query(`SELECT setval(pg_get_serial_sequence('quiz_attempts', 'id'), ${maxId}, true)`);
  }
  counts.quiz_attempts = attempts.length;

  // 6. attempt_answers
  const answers = sqlite.prepare("SELECT * FROM attempt_answers ORDER BY id").all();
  for (const ans of answers) {
    const exists = await client.query("SELECT 1 FROM attempt_answers WHERE id = $1", [ans.id]);
    if (exists.rowCount > 0) continue;
    await client.query(
      `INSERT INTO attempt_answers (id, attempt_id, question_id, selected_index, is_correct)
       VALUES ($1, $2, $3, $4, $5)`,
      [ans.id, ans.attempt_id, ans.question_id, ans.selected_index, ans.is_correct ?? 0],
    );
  }
  if (answers.length > 0) {
    const maxId = Math.max(...answers.map((a) => a.id));
    await client.query(`SELECT setval(pg_get_serial_sequence('attempt_answers', 'id'), ${maxId}, true)`);
  }
  counts.attempt_answers = answers.length;

  // 7. settings
  const settings = sqlite.prepare("SELECT * FROM settings").all();
  for (const s of settings) {
    await client.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [s.key, s.value],
    );
  }
  counts.settings = settings.length;

  await client.query("COMMIT");
  console.log("Migration complete:", JSON.stringify(counts));
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
  sqlite.close();
}
