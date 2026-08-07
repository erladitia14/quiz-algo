/**
 * Akses database SQLite ops-edu-quiz (server-side).
 */
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";

const DB_PATH =
  process.env.QUIZ_DB_PATH?.trim() ||
  path.join(process.cwd(), "data", "quiz.db");

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export type Course = {
  id: number;
  slug: string;
  title: string;
  track: string;
  description: string;
  total_lessons: number;
  active: number;
};

export type Lesson = {
  id: number;
  course_slug: string;
  lesson_number: number;
  module_label: string;
  module_name: string;
  title: string;
  pdf_path: string;
};

export type Question = {
  id: number;
  course_slug: string;
  lesson_ref: string;
  module_ref: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: string;
  active: number;
};

export type Attempt = {
  id: number;
  student_id: number | null;
  student_name: string;
  course_slug: string;
  quiz_type: "pre" | "post";
  total_questions: number;
  correct_count: number;
  score: number;
  started_at: string;
  submitted_at: string | null;
};

export function listCourses(): Course[] {
  return getDb()
    .prepare("SELECT * FROM courses WHERE active = 1 ORDER BY id")
    .all() as Course[];
}

export function getCourse(slug: string): Course | undefined {
  return getDb()
    .prepare("SELECT * FROM courses WHERE slug = ?")
    .get(slug) as Course | undefined;
}

export function listLessons(courseSlug: string): Lesson[] {
  return getDb()
    .prepare(
      "SELECT * FROM lessons WHERE course_slug = ? ORDER BY lesson_number",
    )
    .all(courseSlug) as Lesson[];
}

export function getSettings(): Record<string, string> {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings")
    .all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export function pickRandomQuestions(
  courseSlug: string,
  count: number,
): Question[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM questions WHERE course_slug = ? AND active = 1
       ORDER BY RANDOM() LIMIT ?`,
    )
    .all(courseSlug, count) as Array<Question & { options: string }>;
  return rows.map((r) => ({ ...r, options: JSON.parse(r.options) }));
}

export function getAttempt(attemptId: number): Attempt | undefined {
  return getDb()
    .prepare("SELECT * FROM quiz_attempts WHERE id = ?")
    .get(attemptId) as Attempt | undefined;
}

export function listAttempts(courseSlug?: string): Attempt[] {
  if (courseSlug) {
    return getDb()
      .prepare(
        "SELECT * FROM quiz_attempts WHERE course_slug = ? ORDER BY id DESC LIMIT 200",
      )
      .all(courseSlug) as Attempt[];
  }
  return getDb()
    .prepare("SELECT * FROM quiz_attempts ORDER BY id DESC LIMIT 200")
    .all() as Attempt[];
}

export function findStudentByName(name: string) {
  return getDb()
    .prepare("SELECT * FROM students WHERE lower(name) = lower(?)")
    .get(name.trim()) as { id: number; name: string } | undefined;
}

export function ensureStudent(name: string): number {
  const existing = findStudentByName(name);
  if (existing) return existing.id;
  const result = getDb()
    .prepare("INSERT INTO students (name) VALUES (?)")
    .run(name.trim());
  return Number(result.lastInsertRowid);
}

export function recordAttempt(params: {
  studentName: string;
  courseSlug: string;
  quizType: "pre" | "post";
  questions: Array<{ id: number; selectedIndex: number; isCorrect: boolean }>;
  startedAt: string;
}): number {
  const db = getDb();
  const studentId = ensureStudent(params.studentName);
  const correctCount = params.questions.filter((q) => q.isCorrect).length;
  const score = Math.round((correctCount / params.questions.length) * 100);

  const result = db
    .prepare(
      `INSERT INTO quiz_attempts
        (student_id, student_name, course_slug, quiz_type, total_questions, correct_count, score, started_at, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      studentId,
      params.studentName.trim(),
      params.courseSlug,
      params.quizType,
      params.questions.length,
      correctCount,
      score,
      params.startedAt,
    );
  const attemptId = Number(result.lastInsertRowid);

  const insertAnswer = db.prepare(
    `INSERT INTO attempt_answers (attempt_id, question_id, selected_index, is_correct)
     VALUES (?, ?, ?, ?)`,
  );
  for (const q of params.questions) {
    insertAnswer.run(attemptId, q.id, q.selectedIndex, q.isCorrect ? 1 : 0);
  }
  return attemptId;
}

export function getAttemptAnswers(attemptId: number) {
  return getDb()
    .prepare(
      `SELECT aa.*, q.question, q.options, q.correct_index, q.explanation, q.lesson_ref, q.module_ref
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = ?
       ORDER BY aa.id`,
    )
    .all(attemptId) as Array<{
    id: number;
    question_id: number;
    selected_index: number;
    is_correct: number;
    question: string;
    options: string;
    correct_index: number;
    explanation: string;
    lesson_ref: string;
    module_ref: string;
  }>;
}

export function getCourseStats() {
  return getDb()
    .prepare(
      `SELECT c.slug, c.title,
              (SELECT COUNT(*) FROM questions q WHERE q.course_slug = c.slug AND q.active = 1) AS questions,
              (SELECT COUNT(*) FROM quiz_attempts a WHERE a.course_slug = c.slug AND a.quiz_type = 'pre') AS pre_attempts,
              (SELECT ROUND(AVG(a.score)) FROM quiz_attempts a WHERE a.course_slug = c.slug AND a.quiz_type = 'pre') AS pre_avg,
              (SELECT COUNT(*) FROM quiz_attempts a WHERE a.course_slug = c.slug AND a.quiz_type = 'post') AS post_attempts,
              (SELECT ROUND(AVG(a.score)) FROM quiz_attempts a WHERE a.course_slug = c.slug AND a.quiz_type = 'post') AS post_avg
       FROM courses c WHERE c.active = 1 ORDER BY c.id`,
    )
    .all();
}
