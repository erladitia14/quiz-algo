/**
 * Akses database PostgreSQL quiz-algo (server-side).
 *
 * Quiz berjalan per lesson: setiap lesson punya bank soal sendiri dan
 * pre-test/post-test dicatat per lesson (quiz_attempts.lesson_id).
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
  lesson_id: number | null;
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
  lesson_id: number | null;
  lesson_title: string | null;
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
    "SELECT * FROM lessons WHERE course_slug = $1 AND active = 1 ORDER BY lesson_number",
    [courseSlug],
  );
}

export async function getLesson(lessonId: number): Promise<Lesson | undefined> {
  return queryOne<Lesson>(
    "SELECT * FROM lessons WHERE id = $1 AND active = 1",
    [lessonId],
  );
}

/** Jumlah soal aktif per lesson dalam satu course. */
export async function getLessonQuestionCounts(
  courseSlug: string,
): Promise<Map<number, number>> {
  const rows = await query<{ lesson_id: number; n: number }>(
    `SELECT lesson_id, COUNT(*)::int AS n FROM questions
     WHERE course_slug = $1 AND lesson_id IS NOT NULL AND active = 1
     GROUP BY lesson_id`,
    [courseSlug],
  );
  return new Map(rows.map((r) => [Number(r.lesson_id), Number(r.n)]));
}

/** Statistik pre/post per lesson dalam satu course. */
export type LessonQuizStat = {
  lesson_id: number;
  pre_attempts: number;
  pre_avg: number | null;
  post_attempts: number;
  post_avg: number | null;
};

export async function getLessonQuizStats(
  courseSlug: string,
): Promise<Map<number, LessonQuizStat>> {
  const rows = await query<{
    lesson_id: number;
    pre_attempts: number;
    pre_avg: number | null;
    post_attempts: number;
    post_avg: number | null;
  }>(
    `SELECT lesson_id,
            COUNT(*) FILTER (WHERE quiz_type = 'pre')::int AS pre_attempts,
            ROUND(AVG(score) FILTER (WHERE quiz_type = 'pre'))::float AS pre_avg,
            COUNT(*) FILTER (WHERE quiz_type = 'post')::int AS post_attempts,
            ROUND(AVG(score) FILTER (WHERE quiz_type = 'post'))::float AS post_avg
     FROM quiz_attempts
     WHERE course_slug = $1 AND lesson_id IS NOT NULL
     GROUP BY lesson_id`,
    [courseSlug],
  );
  const map = new Map<number, LessonQuizStat>();
  for (const r of rows) {
    map.set(Number(r.lesson_id), {
      lesson_id: Number(r.lesson_id),
      pre_attempts: Number(r.pre_attempts),
      pre_avg: r.pre_avg,
      post_attempts: Number(r.post_attempts),
      post_avg: r.post_avg,
    });
  }
  return map;
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

/**
 * Ambil semua soal aktif untuk satu lesson (urutan diacak).
 * Quiz per lesson menampilkan seluruh bank soal lesson tersebut.
 */
export async function pickQuestionsForLesson(
  lessonId: number,
): Promise<Question[]> {
  const rows = await query<QuestionRow>(
    `SELECT * FROM questions
     WHERE lesson_id = $1 AND active = 1
     ORDER BY RANDOM()`,
    [lessonId],
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
      "SELECT * FROM questions WHERE course_slug = $1 ORDER BY lesson_id NULLS LAST, module_ref, id",
      [courseSlug],
    );
  }
  return query<QuestionRow>(
    "SELECT * FROM questions ORDER BY course_slug, lesson_id NULLS LAST, module_ref, id",
  );
}

export async function getQuestion(id: number): Promise<QuestionRow | undefined> {
  return queryOne<QuestionRow>("SELECT * FROM questions WHERE id = $1", [id]);
}

/** Validasi soal saat grading: soal wajib milik lesson yang sedang diuji. */
export async function getQuestionForGrading(
  id: number,
  lessonId: number,
): Promise<{ id: number; correct_index: number; explanation: string } | undefined> {
  return queryOne(
    "SELECT id, correct_index, explanation FROM questions WHERE id = $1 AND lesson_id = $2 AND active = 1",
    [id, lessonId],
  );
}

export async function createQuestion(data: {
  course_slug: string;
  lesson_id?: number | null;
  lesson_ref?: string;
  module_ref?: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  difficulty?: string;
}): Promise<number> {
  const result = await getPool().query(
    `INSERT INTO questions (course_slug, lesson_id, lesson_ref, module_ref, question, options, correct_index, explanation, difficulty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      data.course_slug,
      data.lesson_id ?? null,
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
  lessonId: number;
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
         (student_id, student_name, course_slug, lesson_id, quiz_type, total_questions, correct_count, score, started_at, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
       RETURNING id`,
      [
        studentId,
        params.studentName.trim(),
        params.courseSlug,
        params.lessonId,
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
  return queryOne<Attempt>(
    `SELECT a.*, l.title AS lesson_title
     FROM quiz_attempts a
     LEFT JOIN lessons l ON l.id = a.lesson_id
     WHERE a.id = $1`,
    [attemptId],
  );
}

export async function getAttemptScore(
  attemptId: number,
): Promise<{ score: number; correct_count: number } | undefined> {
  return queryOne("SELECT score, correct_count FROM quiz_attempts WHERE id = $1", [
    attemptId,
  ]);
}

export async function listAttempts(filters?: {
  courseSlug?: string;
  lessonId?: number;
}): Promise<Attempt[]> {
  if (filters?.lessonId) {
    return query<Attempt>(
      `SELECT a.*, l.title AS lesson_title
       FROM quiz_attempts a LEFT JOIN lessons l ON l.id = a.lesson_id
       WHERE a.lesson_id = $1 ORDER BY a.id DESC LIMIT 200`,
      [filters.lessonId],
    );
  }
  if (filters?.courseSlug) {
    return query<Attempt>(
      `SELECT a.*, l.title AS lesson_title
       FROM quiz_attempts a LEFT JOIN lessons l ON l.id = a.lesson_id
       WHERE a.course_slug = $1 ORDER BY a.id DESC LIMIT 200`,
      [filters.courseSlug],
    );
  }
  return query<Attempt>(
    `SELECT a.*, l.title AS lesson_title
     FROM quiz_attempts a LEFT JOIN lessons l ON l.id = a.lesson_id
     ORDER BY a.id DESC LIMIT 200`,
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
  lessons_total: number;
  lessons_with_quiz: number;
  pre_attempts: number;
  pre_avg: number | null;
  post_attempts: number;
  post_avg: number | null;
};

export async function getCourseStats(): Promise<CourseStats[]> {
  return query<CourseStats>(
    `SELECT c.slug, c.title,
            (SELECT COUNT(*) FROM questions q WHERE q.course_slug = c.slug AND q.active = 1)::int AS questions,
            (SELECT COUNT(*) FROM lessons l WHERE l.course_slug = c.slug AND l.active = 1)::int AS lessons_total,
            (SELECT COUNT(DISTINCT q.lesson_id) FROM questions q WHERE q.course_slug = c.slug AND q.lesson_id IS NOT NULL AND q.active = 1)::int AS lessons_with_quiz,
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

// ---------------------------------------------------------------------------
// AI models (dikelola admin, dipakai user lewat AI tutor)
// ---------------------------------------------------------------------------

export type AiModel = {
  id: number;
  name: string;
  model_id: string;
  base_url: string;
  api_key: string;
  description: string;
  enabled: number;
  is_default: number;
  created_at: string;
};

export async function listAiModels(onlyEnabled = false): Promise<AiModel[]> {
  if (onlyEnabled) {
    return query<AiModel>(
      "SELECT * FROM ai_models WHERE enabled = 1 ORDER BY is_default DESC, lower(name)",
    );
  }
  return query<AiModel>(
    "SELECT * FROM ai_models ORDER BY is_default DESC, lower(name)",
  );
}

export async function getAiModel(id: number): Promise<AiModel | undefined> {
  return queryOne<AiModel>("SELECT * FROM ai_models WHERE id = $1", [id]);
}

export async function createAiModel(data: {
  name: string;
  model_id: string;
  base_url?: string;
  api_key?: string;
  description?: string;
  enabled?: number;
  is_default?: number;
}): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (data.is_default) {
      await client.query("UPDATE ai_models SET is_default = 0");
    }
    const result = await client.query(
      `INSERT INTO ai_models (name, model_id, base_url, api_key, description, enabled, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.name,
        data.model_id,
        data.base_url || "https://api.openai.com/v1",
        data.api_key || "",
        data.description || "",
        data.enabled ?? 1,
        data.is_default ? 1 : 0,
      ],
    );
    await client.query("COMMIT");
    return Number(result.rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAiModel(
  id: number,
  data: {
    name?: string | null;
    model_id?: string | null;
    base_url?: string | null;
    api_key?: string | null;
    description?: string | null;
    enabled?: number | null;
    is_default?: number | null;
  },
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (data.is_default) {
      await client.query("UPDATE ai_models SET is_default = 0");
    }
    const result = await client.query(
      `UPDATE ai_models SET
         name = COALESCE($1, name),
         model_id = COALESCE($2, model_id),
         base_url = COALESCE($3, base_url),
         api_key = COALESCE($4, api_key),
         description = COALESCE($5, description),
         enabled = COALESCE($6, enabled),
         is_default = COALESCE($7, is_default)
       WHERE id = $8`,
      [
        data.name ?? null,
        data.model_id ?? null,
        data.base_url ?? null,
        data.api_key ?? null,
        data.description ?? null,
        data.enabled ?? null,
        data.is_default ?? null,
        id,
      ],
    );
    await client.query("COMMIT");
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAiModel(id: number): Promise<boolean> {
  const result = await getPool().query("DELETE FROM ai_models WHERE id = $1", [
    id,
  ]);
  return (result.rowCount ?? 0) > 0;
}
