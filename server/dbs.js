import "dotenv/config";
import { logger } from "./logger.js";

import { Pool } from "pg";

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, DATABASE_URL } =
  process.env;

const db_url = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

export const pool = new Pool({
  // connectionString: db_url,
  connectionString: DATABASE_URL,
  max: 10, // pool size
  idleTimeoutMillis: 30000,
});

export async function query(text, params) {
  try {
    const res = await pool.query(text, params);
    return res.rows;
  } catch (err) {
    logger.error("Database", { err: err.stack || err.message });
    throw err;
  }
}

export async function closePool() {
  try {
    await pool.end();
    console.log("Database connection pool closed.");
  } catch (err) {
    logger.error("Database", { err: err.stack || err.message });
  }
}
