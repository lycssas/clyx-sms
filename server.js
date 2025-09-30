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
  findLastPendingByPhone,
  findLastPendingById,
} from "./server/dbsquery.js";
import { query } from "./server/dbs.js";
import { logger } from "./server/logger.js";

const app = express();
const PORT = process.env.PORT || 3001;

const lamAccountId = process.env.LAM_ACCOUNTID;
const lamPassWord = process.env.LAM_PASSWORD;

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
  console.log(req.body);
  try {
    const args = req.body.inArguments?.[0] || {};
    const { phoneField, messageContent, contactKey, buid } = args;

    if (!phoneField || !messageContent || !contactKey || !buid) {
      return res.status(200).json({ outArguments: [{ statusCode: "400" }] });
    }

    const countryPrefix = getCountryPrefix(formatE164(phoneField));
    if (!countryPrefix) {
      console.log("Préfixe pays non trouvé pour le numéro:", phoneField);
      return res.status(200).json({ outArguments: [{ statusCode: "422" }] });
    }
    // 1. Log DB
    const { id } = await insertPending({
      contactKey: contactKey,
      phone: phoneField,
      message: messageContent,
      country: countryPrefix,
      buid: buid,
    });

    console.log("Pending SMS record inserted with ID:", id);

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

    console.log("Sending SMS via LAfricaMobile =>", payload);

    const response = await axios.post(
      "https://lamsms.lafricamobile.com/api",
      payload,
      { timeout: 1200000 }
    );

    console.log("LAfricaMobile response:", response.data);

    return res.status(200).json({ outArguments: [{ statusCode: "200" }] });
  } catch (err) {
    logger.error("Error SMS /execute", {
      stack: err.stack || err.message,
    });
    console.error("Error while sending SMS:", err?.response?.data || err);
    const status = err.response?.status || 500;
    return res
      .status(200)
      .json({ outArguments: [{ statusCode: String(status) }] });
  }
});

/* --------- /dlr : réception des accusés --------- */

// Route pour tester les accusés de réception
app.get("/recept", async (req, res) => {
  console.log("Dlr endpoint called pour tester les accusées de réception");
  console.log("Query params:", req.query);
  const { push_id, to, ret_id, status } = req.query;
  console.log(
    `DLR : push=${push_id}  to=${to}  ret_id=${ret_id}  status=${status}`
  );
  try {
    const numberPart = ret_id.split("_")[1];
    console.log("Extracted ID from ret_id:", numberPart);
    // const rec = await findLastPendingByPhone(to);
    const rec = await findLastPendingById(numberPart);
    if (!rec) {
      console.log(`No pending record found for phone: ${to}`);
      return res.sendStatus(200);
    }

    await updateDlrStatus({ id: rec.id, rawStatus: status, pushId: push_id });
    console.log(`DLR updated for record ID: ${rec.id}`);

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
  console.log("Save endpoint called");
  res.status(200).json({ success: true });
});

app.post("/publish", (req, res) => {
  console.log("Publish endpoint called");
  res.status(200).json({ success: true });
});

app.post("/validate", (req, res) => {
  console.log("Validate endpoint called");
  res.status(200).json({ success: true });
});

app.post("/stop", (req, res) => {
  console.log("Stop endpoint called");
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
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", JSON.stringify(req.body, null, 2));
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
app.listen(PORT, "0.0.0.0", async () => {
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
