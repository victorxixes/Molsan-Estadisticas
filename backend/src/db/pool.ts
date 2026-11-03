import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(process.env.PGSSLMODE === "require"
    ? { ssl: { rejectUnauthorized: true } }
    : {})
});

pool.on("error", (error) => {
  // Never log connection strings or query parameters.
  console.error("Unexpected PostgreSQL pool error", error.message);
});

export async function checkDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}