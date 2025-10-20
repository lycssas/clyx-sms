import "dotenv/config";
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
      env: "Prod",
      status: "error",
      error_type: "DATABASE_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      action: "QUERY",
    };
    await sendAdminAlertIncident(data, MONITORING_ADD_1);
    await sendAdminAlertIncident(data, MONITORING_ADD_2);
    throw err;
  }
}

export async function closePool() {
  try {
    await pool.end();
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
      action: "CLOSE DATABASE",
    };
    await sendAdminAlertIncident(data, MONITORING_ADD_1);
    await sendAdminAlertIncident(data, MONITORING_ADD_2);
  }
}
