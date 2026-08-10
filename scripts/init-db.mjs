/**
 * Inisialisasi database PostgreSQL quiz-algo.
 * Membuat semua tabel yang dibutuhkan platform quiz.
 *
 * Pemakaian: DATABASE_URL=postgresql://... node scripts/init-db.mjs
 * (di lokal DATABASE_URL diambil dari .env.local bila tidak diset manual)
 */
import pg from "pg";
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

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL belum diset.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    track TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    total_lessons INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
    updated_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    lesson_number INTEGER NOT NULL,
    module_label TEXT NOT NULL DEFAULT '',
    module_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    pdf_path TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  );
  CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_slug);

  CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    external_ref TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email ON students(email) WHERE email != '';

  CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    lessons_completed INTEGER NOT NULL DEFAULT 0,
    enrolled_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_enroll_unique ON enrollments(student_id, course_slug);

  CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    lesson_ref TEXT NOT NULL DEFAULT '',
    module_ref TEXT NOT NULL DEFAULT '',
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT NOT NULL DEFAULT '',
    difficulty TEXT NOT NULL DEFAULT 'easy',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  );
  CREATE INDEX IF NOT EXISTS idx_questions_course ON questions(course_slug);

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    quiz_type TEXT NOT NULL CHECK(quiz_type IN ('pre','post')),
    total_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
    submitted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_course ON quiz_attempts(course_slug);
  CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id);

  CREATE TABLE IF NOT EXISTS attempt_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_index INTEGER NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_answers_attempt ON attempt_answers(attempt_id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

await pool.query(
  `INSERT INTO settings (key, value) VALUES ('quiz_question_count', '10')
   ON CONFLICT (key) DO NOTHING`,
);
await pool.query(
  `INSERT INTO settings (key, value) VALUES ('quiz_pass_threshold', '70')
   ON CONFLICT (key) DO NOTHING`,
);

await pool.end();
console.log("Database initialized OK");
