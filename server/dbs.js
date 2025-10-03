import "dotenv/config";
import { logger } from "./logger.js";
import { sendAdminAlertIncident } from "./monitoring/monitoring.js";

import { Pool } from "pg";

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT,
  DATABASE_URL,
  MONITORING_ADD_1,
  MONITORING_ADD_2,
} = process.env;

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
    const data = {
      app: "clyx-sms",
      env: "local",
      status: "error",
      error_type: "DATABASE_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: "amadoungom@agencelycs.com",
      action: "UPSERT_Rows",
    };
    // console.log("Data:", data);
    const result = await sendAdminAlertIncident(data, MONITORING_ADD_1);
    const result2 = await sendAdminAlertIncident(data, MONITORING_ADD_2);
    console.log("monitor ; ", result);
    // logger.error("Database", { err: err.stack || err.message });
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
