import cors from "cors";
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
import { logger } from "./server/logger.js";
import { sendAdminAlertIncident } from "./server/monitoring/monitoring.js";

const app = express();
const PORT = process.env.PORT || 3001;

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

/* ==== Fichiers statiques du front ==== */
const buildDir = path.join(process.cwd(), "build"); // CRA

/* --------- Helpers --------- */
function formatE164(number) {
  return number.replace(/^0+/, "").replace(/^00/, "+").replace(/^\+?/, "+");
}

/* --------- /execute : envoi SMS --------- */
app.post("/execute", async (req, res) => {
  console.log("Execute endpoint called");
  console.log("informations reçues dans le corps de la requête:");
  try {
    // console.log("Processing /execute with payload:", req.body);
    const args = req.body.inArguments?.[0] || {};
    const {
      phoneField,
      messageContent,
      contactKey,
      buid,
      campaignName,
      smsName,
    } = args;
    const versionId = req.body?.definitionInstanceId || "";
    const activityId = req.body?.activityId || "";
    const journeyId = req.body?.journeyId || "";

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
      campaignName: campaignName,
      smsName: smsName,
      smsId: `SMS_${versionId}`,
      smsCount: Math.max(1, Math.ceil(messageContent.length / 160)),
    });

    const bodyMessage = await rewriteBody(messageContent, id);

    // const from = process.env.SENDER_ID || formatE164(devPhoneNumber);
    const to = formatPhoneNumber(phoneField);

    /* payload LAfricaMobile */
    const payload = {
      accountid: lamAccountId,
      password: lamPassWord,
      sender: "LAM TEST", // à personnaliser
      ret_id: `sms_${id}`, // pour le DLR
      priority: "2",
      text: bodyMessage,
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
      env: "local",
      status: "error",
      error_type: "DATABASE_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: null,
      action: "UPSERT_Rows",
    };
    // console.log("Data:", data);
    const result = await sendAdminAlertIncident(data, MONITORING_ADD_1);
    const result2 = await sendAdminAlertIncident(data, MONITORING_ADD_2);
    // logger.error("Error SMS /execute", {
    //   stack: err.stack || err.message,
    // });
    // console.error("Error while sending SMS:", err?.response?.data || err);
    const status = err.response?.status || 500;
    return res
      .status(200)
      .json({ outArguments: [{ statusCode: String(status) }] });
  }
});

/* --------- /dlr : réception des accusés --------- */

// Route pour tester les accusés de réception
app.get("/recept", async (req, res) => {
  const { push_id, to, ret_id, status } = req.query;

  try {
    const numberPart = ret_id.split("_")[1];
    // const rec = await findLastPendingByPhone(to);
    const rec = await findLastPendingById(numberPart);
    if (!rec) {
      return res.sendStatus(200);
    }

    await updateDlrStatus({ id: rec.id, rawStatus: status, pushId: push_id });

    res.sendStatus(200); // Important : répondre 200 rapidement
  } catch (err) {
    logger.error("Error processing DLR", {
      stack: err.stack || err.message,
    });
    console.error("❌", err.response?.data || err);
  }
});

// Routes de configuration Journey Builder
app.post("/save", (req, res) => {
  res.status(200).json({ success: true });
});

app.post("/publish", (req, res) => {
  res.status(200).json({ success: true });
});

app.post("/validate", (req, res) => {
  res.status(200).json({ success: true });
});

app.post("/stop", (req, res) => {
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

app.use(express.static(buildDir));
app.get("*", (_, res) => res.sendFile(path.join(buildDir, "index.html")));

// Logs pour toutes les requêtes
app.use((err, req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
  }
  logger.error("Erreur Express non gérée", { stack: err.stack });
  // if (err) {
  //   console.error("Error:", err);
  //   logger.error(`Error: ${err.message}`, { stack: err.stack });
  //   res.status(500).send("Internal Server Error");
  // } else {
  //   logger.info(`${req.method} ${req.url}`);
  // }
  next();
});

// Démarrer le serveur
app.listen(PORT, "localhost", async () => {
  try {
    logger.info(`Serveur démarré sur le port ${PORT}`);
    console.log(`Serveur démarré sur le port ${PORT}`);
    const rows = await query("SELECT NOW() AS now", []);
    console.log("Database connection pool initialized.");
    console.log("Database connection pool status:", rows);
    console.log(`Accédez à http://0.0.0.0:${PORT}/ pour votre custom activity`);
  } catch (error) {
    logger.error("Error starting server", {
      stack: error.stack || error.message,
    });
    console.error(
      "Error starting server:",
      error.response?.data || error.message
    );
  }
});
