/**
 * Inisialisasi database SQLite ops-edu-quiz.
 * Membuat semua tabel yang dibutuhkan platform quiz.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dbPath = path.join(root, "data", "quiz.db");

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  -- Katalog course (sync dari ops-edu / Algonova)
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    track TEXT NOT NULL,
    description TEXT DEFAULT '',
    total_lessons INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Lesson per course (untuk referensi materi & soal)
  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    lesson_number INTEGER NOT NULL,
    module_label TEXT DEFAULT '',
    module_name TEXT DEFAULT '',
    title TEXT NOT NULL,
    pdf_path TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_slug);

  -- Siswa
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    external_ref TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email ON students(email) WHERE email != '';

  -- Enrollment: siswa ikut course mana
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    status TEXT DEFAULT 'active',
    lessons_completed INTEGER DEFAULT 0,
    enrolled_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_enroll_unique ON enrollments(student_id, course_slug);

  -- Bank soal per course
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    lesson_ref TEXT DEFAULT '',
    module_ref TEXT DEFAULT '',
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT DEFAULT '',
    difficulty TEXT DEFAULT 'easy',
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_questions_course ON questions(course_slug);

  -- Percobaan quiz
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    course_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    quiz_type TEXT NOT NULL CHECK(quiz_type IN ('pre','post')),
    total_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    submitted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_course ON quiz_attempts(course_slug);
  CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id);

  -- Jawaban per soal dalam satu percobaan
  CREATE TABLE IF NOT EXISTS attempt_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_index INTEGER NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_answers_attempt ON attempt_answers(attempt_id);

  -- Pengaturan quiz
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const defaults = {
  quiz_question_count: "10",
  quiz_pass_threshold: "70",
};
const insert = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
);
for (const [key, value] of Object.entries(defaults)) {
  insert.run(key, value);
}

db.close();
console.log("Database initialized at:", dbPath);
