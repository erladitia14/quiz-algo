import { Pool, PoolClient } from "pg";

let pool: Pool;

// Create or get existing pool
export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

// Get a database client for transactions
export async function getDbClient(): Promise<PoolClient> {
  const client = await getDbPool().connect();
  return client;
}

// Close the pool (for edge runtime)
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Simple queries for quiz app
export async function getCourses() {
  const client = await getDbPool().query(
    'SELECT id, name, description FROM courses ORDER BY created_at DESC'
  );
  return client.rows;
}

export async function getQuestions(courseId: number) {
  const client = await getDbPool().query(
    'SELECT id, course_id, question, options, correct_index FROM questions WHERE course_id = $1',
    [courseId]
  );
  return client.rows;
}
