import { Pool, PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../drizzle/schema";

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

// Get drizzle client with schema
export const db = drizzle(getDbPool(), { schema });

// Get a transaction client
export async function getDbClient(): Promise<PoolClient> {
  const client = await getDbPool().connect();
  return client;
}
