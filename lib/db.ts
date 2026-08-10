/**
 * Akses database PostgreSQL quiz-algo (server-side).
 *
 * Skema dipertahankan identik dengan versi SQLite lama (kolom snake_case,
 * options sebagai JSON string, flag 0/1 sebagai integer) supaya data lama
 * bisa dimigrasikan 1:1 dan logika aplikasi tidak perlu berubah.
 */
import { Pool } from "pg";
import type { PoolClient } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL belum diset.");
    }
    const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(
      connectionString,
    );
    pool = new Pool({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
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

export type AttemptAnswer = {
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
};

type QuestionRow = Omit<Question, "options"> & { options: string };

function parseQuestion(row: QuestionRow): Question {
  return { ...row, options: JSON.parse(row.options) as string[] };
}

// ---------------------------------------------------------------------------
// Courses & lessons
// ---------------------------------------------------------------------------

export async function listCourses(): Promise<Course[]> {
  return query<Course>(
    "SELECT * FROM courses WHERE active = 1 ORDER BY id",
  );
}

export async function getCourse(slug: string): Promise<Course | undefined> {
  return queryOne<Course>("SELECT * FROM courses WHERE slug = $1", [slug]);
}

export async function listLessons(courseSlug: string): Promise<Lesson[]> {
  return query<Lesson>(
    "SELECT * FROM lessons WHERE course_slug = $1 ORDER BY lesson_number",
    [courseSlug],
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings",
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getPool().query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function pickRandomQuestions(
  courseSlug: string,
  count: number,
): Promise<Question[]> {
  const rows = await query<QuestionRow>(
    `SELECT * FROM questions WHERE course_slug = $1 AND active = 1
     ORDER BY RANDOM() LIMIT $2`,
    [courseSlug, count],
  );
  return rows.map(parseQuestion);
}

export async function countQuestions(courseSlug: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM questions WHERE course_slug = $1 AND active = 1",
    [courseSlug],
  );
  return row ? row.count : 0;
}

export async function listQuestionsAdmin(
  courseSlug?: string,
): Promise<QuestionRow[]> {
  if (courseSlug) {
    return query<QuestionRow>(
      "SELECT * FROM questions WHERE course_slug = $1 ORDER BY module_ref, lesson_ref, id",
      [courseSlug],
    );
  }
  return query<QuestionRow>(
    "SELECT * FROM questions ORDER BY course_slug, module_ref, lesson_ref, id",
  );
}

export async function getQuestion(id: number): Promise<QuestionRow | undefined> {
  return queryOne<QuestionRow>("SELECT * FROM questions WHERE id = $1", [id]);
}

export async function getQuestionForGrading(
  id: number,
  courseSlug: string,
): Promise<{ id: number; correct_index: number; explanation: string } | undefined> {
  return queryOne(
    "SELECT id, correct_index, explanation FROM questions WHERE id = $1 AND course_slug = $2",
    [id, courseSlug],
  );
}

export async function createQuestion(data: {
  course_slug: string;
  lesson_ref?: string;
  module_ref?: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  difficulty?: string;
}): Promise<number> {
  const result = await getPool().query(
    `INSERT INTO questions (course_slug, lesson_ref, module_ref, question, options, correct_index, explanation, difficulty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      data.course_slug,
      data.lesson_ref || "",
      data.module_ref || "",
      data.question,
      JSON.stringify(data.options),
      data.correct_index,
      data.explanation || "",
      data.difficulty || "easy",
    ],
  );
  return Number(result.rows[0].id);
}

export async function updateQuestion(
  id: number,
  data: {
    question?: string | null;
    options?: string[] | null;
    correct_index?: number | null;
    explanation?: string | null;
    difficulty?: string | null;
    module_ref?: string | null;
    lesson_ref?: string | null;
    active?: number | null;
  },
): Promise<boolean> {
  const result = await getPool().query(
    `UPDATE questions SET
       question = COALESCE($1, question),
       options = COALESCE($2, options),
       correct_index = COALESCE($3, correct_index),
       explanation = COALESCE($4, explanation),
       difficulty = COALESCE($5, difficulty),
       module_ref = COALESCE($6, module_ref),
       lesson_ref = COALESCE($7, lesson_ref),
       active = COALESCE($8, active)
     WHERE id = $9`,
    [
      data.question ?? null,
      data.options ? JSON.stringify(data.options) : null,
      data.correct_index ?? null,
      data.explanation ?? null,
      data.difficulty ?? null,
      data.module_ref ?? null,
      data.lesson_ref ?? null,
      data.active ?? null,
      id,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteQuestion(id: number): Promise<boolean> {
  const result = await getPool().query(
    "DELETE FROM questions WHERE id = $1",
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Students & attempts
// ---------------------------------------------------------------------------

export async function findStudentByName(
  name: string,
): Promise<{ id: number; name: string } | undefined> {
  return queryOne("SELECT id, name FROM students WHERE lower(name) = lower($1)", [
    name.trim(),
  ]);
}

async function ensureStudentWith(
  client: PoolClient,
  name: string,
): Promise<number> {
  const existing = await client.query(
    "SELECT id FROM students WHERE lower(name) = lower($1)",
    [name.trim()],
  );
  if (existing.rows[0]) return Number(existing.rows[0].id);
  const inserted = await client.query(
    "INSERT INTO students (name) VALUES ($1) RETURNING id",
    [name.trim()],
  );
  return Number(inserted.rows[0].id);
}

export async function recordAttempt(params: {
  studentName: string;
  courseSlug: string;
  quizType: "pre" | "post";
  questions: Array<{
    id: number;
    selectedIndex: number;
    isCorrect: boolean;
  }>;
  startedAt: string;
}): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const studentId = await ensureStudentWith(client, params.studentName);
    const correctCount = params.questions.filter((q) => q.isCorrect).length;
    const score = Math.round((correctCount / params.questions.length) * 100);

    const result = await client.query(
      `INSERT INTO quiz_attempts
         (student_id, student_name, course_slug, quiz_type, total_questions, correct_count, score, started_at, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
       RETURNING id`,
      [
        studentId,
        params.studentName.trim(),
        params.courseSlug,
        params.quizType,
        params.questions.length,
        correctCount,
        score,
        params.startedAt,
      ],
    );
    const attemptId = Number(result.rows[0].id);

    for (const q of params.questions) {
      await client.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, selected_index, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [attemptId, q.id, q.selectedIndex, q.isCorrect ? 1 : 0],
      );
    }
    await client.query("COMMIT");
    return attemptId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAttempt(attemptId: number): Promise<Attempt | undefined> {
  return queryOne<Attempt>("SELECT * FROM quiz_attempts WHERE id = $1", [
    attemptId,
  ]);
}

export async function getAttemptScore(
  attemptId: number,
): Promise<{ score: number; correct_count: number } | undefined> {
  return queryOne("SELECT score, correct_count FROM quiz_attempts WHERE id = $1", [
    attemptId,
  ]);
}

export async function listAttempts(courseSlug?: string): Promise<Attempt[]> {
  if (courseSlug) {
    return query<Attempt>(
      "SELECT * FROM quiz_attempts WHERE course_slug = $1 ORDER BY id DESC LIMIT 200",
      [courseSlug],
    );
  }
  return query<Attempt>(
    "SELECT * FROM quiz_attempts ORDER BY id DESC LIMIT 200",
  );
}

export async function getAttemptAnswers(
  attemptId: number,
): Promise<AttemptAnswer[]> {
  return query<AttemptAnswer>(
    `SELECT aa.*, q.question, q.options, q.correct_index, q.explanation, q.lesson_ref, q.module_ref
     FROM attempt_answers aa
     JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = $1
     ORDER BY aa.id`,
    [attemptId],
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export type CourseStats = {
  slug: string;
  title: string;
  questions: number;
  pre_attempts: number;
  pre_avg: number | null;
  post_attempts: number;
  post_avg: number | null;
};

export async function getCourseStats(): Promise<CourseStats[]> {
  return query<CourseStats>(
    `SELECT c.slug, c.title,
            (SELECT COUNT(*) FROM questions q WHERE q.course_slug = c.slug AND q.active = 1)::int AS questions,
            (SELECT COUNT(*) FROM quiz_attempts a WHERE a.course_slug = c.slug AND a.quiz_type = 'pre')::int AS pre_attempts,
            (SELECT ROUND(AVG(a.score))::float FROM quiz_attempts a WHERE a.course_slug = c.slug AND a.quiz_type = 'pre') AS pre_avg,
            (SELECT COUNT(*) FROM quiz_attempts a WHERE a.course_slug = c.slug AND a.quiz_type = 'post')::int AS post_attempts,
            (SELECT ROUND(AVG(a.score))::float FROM quiz_attempts a WHERE a.course_slug = c.slug AND a.quiz_type = 'post') AS post_avg
     FROM courses c WHERE c.active = 1 ORDER BY c.id`,
  );
}

export type StudentStats = {
  id: number;
  name: string;
  email: string;
  attempts: number;
  pre_avg: number | null;
  post_avg: number | null;
};

export async function listStudentsWithStats(): Promise<StudentStats[]> {
  return query<StudentStats>(
    `SELECT s.id, s.name, s.email,
            COUNT(a.id)::int AS attempts,
            ROUND(AVG(CASE WHEN a.quiz_type = 'pre' THEN a.score END))::float AS pre_avg,
            ROUND(AVG(CASE WHEN a.quiz_type = 'post' THEN a.score END))::float AS post_avg
     FROM students s
     LEFT JOIN quiz_attempts a ON a.student_id = s.id
     GROUP BY s.id, s.name, s.email
     ORDER BY attempts DESC, s.name
     LIMIT 100`,
  );
}
