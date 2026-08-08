import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Backward compatibility for old code that uses getDb
export function getDb() {
  return pool;
}

// Helper to get a client
export async function getClient() {
  const client = await pool.connect();
  return client;
}

export async function query(sql: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// Course queries
export async function listCourses() {
  return query("SELECT * FROM courses ORDER BY created_at DESC");
}

export async function getCourse(id: number) {
  const rows = await query("SELECT * FROM courses WHERE id = $1", [id]);
  return rows[0];
}

export async function createCourse(data: any) {
  const result = await query(
    `INSERT INTO courses (title, description, duration_min, is_published) 
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.title, data.description, data.duration_min, data.is_published]
  );
  return result.rows[0];
}

export async function updateCourse(id: number, data: any) {
  const result = await query(
    `UPDATE courses SET title = $1, description = $2, duration_min = $3, is_published = $4 
     WHERE id = $5 RETURNING *`,
    [data.title, data.description, data.duration_min, data.is_published, id]
  );
  return result.rows[0];
}

export async function deleteCourse(id: number) {
  await query("DELETE FROM courses WHERE id = $1", [id]);
  return true;
}

export async function getCourseStats(courseId: number) {
  const totalAttempts = (await query("SELECT COUNT(*) as count FROM attempts WHERE course_id = $1", [courseId]))[0];
  const avgScore = (await query("SELECT AVG(score/total_score * 100) as avg FROM attempts WHERE course_id = $1 AND status = 'completed'", [courseId]))[0];
  return { courseId, totalAttempts: parseInt(totalAttempts.count), avgScore: parseFloat(avgScore.avg) };
}

// Question queries  
export async function listQuestions(courseId: number) {
  return query("SELECT * FROM questions WHERE course_id = $1 ORDER BY order_index", [courseId]);
}

export async function getQuestion(id: number) {
  const rows = await query("SELECT * FROM questions WHERE id = $1", [id]);
  return rows[0];
}

export async function createQuestion(data: any) {
  const result = await query(
    `INSERT INTO questions (course_id, question, options, correct_index, difficulty, explanation) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.course_id, data.question, JSON.stringify(data.options), data.correct_index, data.difficulty, data.explanation]
  );
  return result.rows[0];
}

export async function updateQuestion(id: number, data: any) {
  const result = await query(
    `UPDATE questions SET question = $1, options = $2, correct_index = $3, difficulty = $4, explanation = $5 
     WHERE id = $6 RETURNING *`,
    [data.question, JSON.stringify(data.options), data.correct_index, data.difficulty, data.explanation, id]
  );
  return result.rows[0];
}

export async function deleteQuestion(id: number) {
  await query("DELETE FROM questions WHERE id = $1", [id]);
  return true;
}

// Attempt queries
export async function listAttempts() {
  return query(`
    SELECT attempts.*, courses.title as course_title 
    FROM attempts 
    JOIN courses ON attempts.course_id = courses.id 
    ORDER BY attempts.created_at DESC
  `);
}

export async function getAttempt(id: number) {
  const rows = await query(`
    SELECT attempts.*, courses.title as course_title 
    FROM attempts 
    JOIN courses ON attempts.course_id = courses.id 
    WHERE attempts.id = $1
  `, [id]);
  return rows[0];
}

export async function createAttempt(data: any) {
  const result = await query(
    `INSERT INTO attempts (course_id, user_name, score, total_score, status) 
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.course_id, data.user_name, data.score, data.total_score, data.status]
  );
  return result.rows[0];
}

export async function updateAttemptStatus(id: number, status: string, score?: number, totalScore?: number) {
  if (score !== undefined && totalScore !== undefined) {
    const result = await query(
      `UPDATE attempts SET status = $1, score = $2, total_score = $3 WHERE id = $4 RETURNING *`,
      [status, score, totalScore, id]
    );
    return result.rows[0];
  } else {
    const result = await query(
      `UPDATE attempts SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }
}

export async function deleteAttempt(id: number) {
  await query("DELETE FROM attempts WHERE id = $1", [id]);
  return true;
}

// Get attempt answers with question details
export async function getAttemptAnswers(attemptId: number) {
  return query(`
    SELECT aa.*, q.question, q.options, q.correct_index
    FROM attempt_answers aa
    JOIN questions q ON aa.question_id = q.id
    WHERE aa.attempt_id = $1
  `, [attemptId]);
}

export async function createAttemptAnswer(data: any) {
  const result = await query(
    `INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct) 
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.attempt_id, data.question_id, data.selected_option, data.is_correct]
  );
  return result.rows[0];
}

// Settings queries
export async function getSettings() {
  return query("SELECT * FROM settings LIMIT 1");
}

export async function updateSetting(key: string, value: any) {
  const result = await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) 
     ON CONFLICT (key) DO UPDATE SET value = $2 RETURNING *`,
    [key, JSON.stringify(value)]
  );
  return result.rows[0];
}
