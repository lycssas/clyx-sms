import * as cors from "cors";
import bodyParser from "body-parser";
import express from "express";
import path from "path";
import axios from "axios";
import {
  formatPhoneNumber,
  rewriteBody,
  getCountryPrefix,
} from "./server/functions.js";
import {
  insertPending,
  updateDlrStatus,
  findLastPendingById,
} from "./server/dbsquery.js";
import { query } from "./server/dbs.js";
import { sendAdminAlertIncident } from "./server/monitoring.js";
import { fileURLToPath } from "url";
import { flushTrackingSMS } from "./server/sfmc.service.js";
// import session from "express-session";
import { verifySfmcJwt, initConfig } from "./server/sfmcconfig.js";

const app = express();
const PORT = process.env.PORT;

const lamAccountId = process.env.LAM_ACCOUNTID;
const lamPassWord = process.env.LAM_PASSWORD;
const MONITORING_ADD_1 = process.env.MONITORING_ADD_1;
const MONITORING_ADD_2 = process.env.MONITORING_ADD_2;

const axiosInstance = axios.create({
  timeout: 30000, // 30 secondes
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.raw({ type: "application/jwt", limit: "2mb" }));
app.use(express.json());

const buildDir = path.join(process.cwd(), "build"); // CRA

const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

function formatE164(number) {
  return number.replace(/^0+/, "").replace(/^00/, "+").replace(/^\+?/, "+");
}

app.post("/execute", verifySfmcJwt, async (req, res) => {
  try {
    // console.log("Processing /execute with payload:", req.body);
    const args = req.sfmcJwt.inArguments?.[0] || {};
    const {
      phoneField,
      messageContent,
      contactKey,
      buid,
      campaignCode,
      smsName,
    } = args;
    const versionId = req.sfmcJwt?.definitionInstanceId || "";
    const activityId = req.sfmcJwt?.activityId || "";
    const journeyId = req.sfmcJwt?.journeyId || "";

    if (!phoneField || !messageContent || !contactKey || !buid) {
      return res.status(200).json({ outArguments: [{ statusCode: "400" }] });
    }

    const countryPrefix = getCountryPrefix(formatE164(phoneField));
    if (!countryPrefix) {
      return res.status(200).json({ outArguments: [{ statusCode: "422" }] });
    }

    // 1. Log DB
    const { id } = await insertPending({
      contactKey: contactKey,
      phone: phoneField,
      message: messageContent,
      country: countryPrefix,
      buid: buid,
      versionId: versionId,
      activityId: activityId,
      journeyId: journeyId,
      campaignCode: campaignCode,
      smsName: smsName,
      smsId: `SMS_${versionId}`,
      smsCount: Math.max(1, Math.ceil(messageContent.length / 160)),
      eventDate: new Date().toISOString(),
    });

    const bodyMessage = await rewriteBody(messageContent, id);
    const to = formatPhoneNumber(phoneField);

    /* payload LAfricaMobile */
    const payload = {
      accountid: lamAccountId,
      password: lamPassWord,
      sender: "AIR CI", // à personnaliser
      ret_id: `sms_${id}`, // pour le DLR
      priority: "2",
      text: bodyMessage,
      datacoding: 2,
      ret_url: `${process.env.BASE_URL}/recept`, // callback DLR
      to: [
        {
          ret_id_1: to,
        },
      ],
    };

    const response = await axios.post(
      "https://lamsms.lafricamobile.com/api",
      payload,
      { timeout: 1200000 }
    );

    return res.status(200).json({ outArguments: [{ statusCode: "200" }] });
  } catch (err) {
    const data = {
      app: "clyx-sms",
      env: "PROD",
      status: "error",
      error_type: "ENDPOINT_EXECUTE_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: null,
      action: "Send SMS",
    };
    sendAdminAlertIncident(data, MONITORING_ADD_1);
    sendAdminAlertIncident(data, MONITORING_ADD_2);
    const status = err.response?.status || 500;
    return res
      .status(200)
      .json({ outArguments: [{ statusCode: String(status) }] });
  }
});

// Route pour tester les accusés de réception
app.get("/recept", async (req, res) => {
  // console.log("DLR received:");
  const { push_id, to, ret_id, status } = req.query;

  try {
    const numberPart = ret_id.split("_")[1];
    // const rec = await findLastPendingByPhone(to);
    // console.log("Looking for record with ID:", numberPart);
    const rec = await findLastPendingById(numberPart);
    if (!rec) {
      return res.sendStatus(200);
    }

    const rep = await flushTrackingSMS({ id: rec.id, push_id, status });

    await updateDlrStatus({ id: rec.id, rawStatus: status, pushId: push_id });

    res.sendStatus(200); // Important : répondre 200 rapidement
  } catch (err) {
    const data = {
      app: "clyx-sms",
      env: "PROD",
      status: "error",
      error_type: "DELIVERY_RECEIPT_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: null,
      action: "Delivery recept",
    };
    await sendAdminAlertIncident(data, MONITORING_ADD_1);
    await sendAdminAlertIncident(data, MONITORING_ADD_2);
    res.sendStatus(200);
  }
});

// Routes de configuration Journey Builder
app.post("/save", verifySfmcJwt, (req, res) => {
  console.log("save endpoint called");
  res.status(200).json({ success: true });
});

app.post("/publish", verifySfmcJwt, (req, res) => {
  console.log("publish endpoint called");
  res.status(200).json({ success: true });
});

app.post("/validate", verifySfmcJwt, (req, res) => {
  console.log("validate endpoint called");
  res.status(200).json({ success: true });
});

app.post("/stop", verifySfmcJwt, (req, res) => {
  console.log("stop endpoint called");
  res.status(200).json({ success: true });
});

// Route pour tester le serveur
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Orange SMS Activity Server is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/ping", (_req, res) => {
  res.status(200).send("pong");
});

app.get("/init", async (req, res) => {
  // Récupérer les configurations depuis la base
  await initConfig(req, res);
});

// console.log("Serving static files from:", buildDir);

app.use(express.static(buildDir));
// app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_, res) => res.sendFile(path.join(buildDir, "index.html")));

// Logs pour toutes les requêtes
app.use((err, req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
  }
  next();
});

// Démarrer le serveur
app.listen(PORT, "0.0.0.0", async () => {
  try {
    const rows = await query("SELECT NOW() AS now", []);
    console.log("Database connection pool status:", rows);
    console.log(`Accédez à http://0.0.0.0:${PORT}/ pour votre custom activity`);
  } catch (err) {
    const data = {
      app: "clyx-sms",
      env: "PROD",
      status: "error",
      error_type: "RUNNING_SERVER_ERROR",
      error_message: err.message || null,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: null,
      action: "Run server",
    };
    await sendAdminAlertIncident(data, MONITORING_ADD_1);
    await sendAdminAlertIncident(data, MONITORING_ADD_2);
  }
});
