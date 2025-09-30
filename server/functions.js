import { createReadStream, promises as fs } from "fs";
import readline from "readline";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";
import { logger } from "./logger.js";
dotenv.config();

import { upsertUrl, linkUrlToSms } from "./shortnerfunctions.js";

const mapCountryToPrefix = [
  { code: "FR", prefix: "+33" },
  { code: "SN", prefix: "+221" },
  { code: "CI", prefix: "+225" },
  { code: "ML", prefix: "+223" },
  { code: "BF", prefix: "+226" },
  { code: "TG", prefix: "+228" },
  { code: "BJ", prefix: "+229" },
  { code: "GC", prefix: "+224" },
  { code: "GB", prefix: "+245" },
  { code: "MA", prefix: "+212" },
  { code: "GH", prefix: "+233" },
  { code: "NG", prefix: "+234" },
  { code: "NE", prefix: "+227" },
  { code: "CM", prefix: "+237" },
  { code: "GA", prefix: "+241" },
  { code: "CG", prefix: "+242" },
  { code: "RC", prefix: "+243" },
];

// Cette fonction prend un numero de telephone et retourne le code pays correspondant en se bassant sur le map mapCountryToPrefix
export function getCountryPrefix(phone) {
  // phone = `+${phone}`; // s'assure que c'est une chaine
  for (const entry of mapCountryToPrefix) {
    if (phone.startsWith(entry.prefix)) {
      return entry.code;
    }
  }
  return null;
}

// Information maketing cloud
const {
  MC_CLIENT_ID,
  MC_CLIENT_SECRET,
  MC_ACCOUNT_ID,
  DE_KEY,
  MC_SUBDOMAIN,
  SHORT_URL,
} = process.env;
// Chemin vers le fichier de logs
// const FILE = path.join(process.cwd(), "sms_log.ndjson");
export const FILE_PENDING = path.join(process.cwd(), "pending_sms_log.ndjson");
export const FILE_RECEIPTS = path.join(
  process.cwd(),
  "receipts_sms_log.ndjson"
);

// Ecrire sur le fichier de logs
export async function addRecord(fic, rec) {
  console.log("addRecord called with:", rec);
  await fs.appendFile(fic, JSON.stringify(rec) + "\n");
}

// Recherche par numéro, retourne { record, remainder }
export async function findAndRemoveByPhone(phone) {
  const rl = readline.createInterface({
    input: createReadStream(FILE_PENDING),
    crlfDelay: Infinity,
  });

  let found = null;
  const linesToKeep = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    console.log("obj", obj);
    if (!found && obj.Phone === phone) {
      found = obj;
    } else {
      linesToKeep.push(line);
    }
  }

  if (found) {
    // ré‑écrit le fichier sans la ligne trouvée (replace‑write)
    await fs.writeFile(FILE, linesToKeep.join("\n") + "\n");
  }
  return found;
}

export async function buildRowsFromReceipts() {
  const rows = [];
  const rl = readline.createInterface({
    input: createReadStream(FILE_RECEIPTS),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const { ContactKey, Status } = JSON.parse(line);
    rows.push({ ContactKey, Status }); // ==> [{ContactKey, Status}, ...]
  }
  return rows;
}

// Obtention du token marketing cloud
export async function getMcToken() {
  try {
    let token,
      tokenExp = 0;
    const now = Date.now();
    if (token && now < tokenExp) return token; // token encore valable

    const url = `https://${MC_SUBDOMAIN}.auth.marketingcloudapis.com/v2/token`;
    const { data } = await axios.post(url, {
      client_id: MC_CLIENT_ID,
      client_secret: MC_CLIENT_SECRET,
      account_id: MC_ACCOUNT_ID,
      grant_type: "client_credentials",
    });

    token = data.access_token;
    tokenExp = now + (data.expires_in - 60) * 1000; // marge de 60 s
    return token;
  } catch (error) {
    logger.error("SFMC error", {
      stack: error.stack || error.message,
    });
    console.log(
      "SFMC error access token:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Insertion d’une ligne (ou d’un lot) dans la DE
export async function insertRows(rows) {
  const accessToken = await getMcToken();
  try {
    const url =
      `https://${MC_SUBDOMAIN}.rest.marketingcloudapis.com` +
      `/data/v1/async/dataextensions/key:${DE_KEY}/rows`;
    const res = await axios.post(url, rows, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (error) {
    logger.error("SFMC error", {
      stack: error.stack || error.message,
    });
    console.log("SFMC error", error.response?.data || error.message);
    throw error;
  }
}

export async function upsertRows(rows, deKey) {
  const accessToken = await getMcToken();
  try {
    const url =
      `https://${MC_SUBDOMAIN}.rest.marketingcloudapis.com` +
      `/data/v1/async/dataextensions/key:${deKey}/rows`;
    const res = await axios.put(url, rows, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (error) {
    logger.error("SFMC error", {
      stack: error.stack || error.message,
    });
    console.log(
      "Error upserting rows into Marketing Cloud:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Fonction utilitaire pour formatter un numéro au format Orange (+221)
export function formatPhoneNumber(phone) {
  // Supprime tout sauf les chiffres
  let clean = phone.replace(/\D/g, "");

  return `+${clean}`;
}

// Fonction pour obtenir le token d'accès Orange
export async function getOrangeAccessToken() {
  try {
    const tokenUrl = "https://api.orange.com/oauth/v3/token";

    // Créer la chaîne "client_id:client_secret"
    const authString = `${CLIENT_ID}:${CLIENT_SECRET}`;

    // Encoder en Base64
    const encodedAuth = Buffer.from(authString).toString("base64");

    const response = await axios({
      method: "POST",
      url: tokenUrl,
      headers: {
        Authorization: `Basic ${encodedAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "grant_type=client_credentials",
    });

    console.log("Token obtained successfully");
    return response.data.access_token;
  } catch (error) {
    console.error(
      "Error getting Orange access token:",
      error.response?.data || error.message
    );
    throw error;
  }
}

export async function rewriteBody(body, smsId) {
  try {
    const URL_RX =
      /((?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:\/[^\s<>"']*)?|www\.(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:\/[^\s<>"']*)?)/gi;
    const matches = [...body.matchAll(URL_RX)];
    for (const [full] of matches) {
      const urls = await upsertUrl(full);
      // Link url to SMS log if smsLogId is provided
      if (smsId) {
        await linkUrlToSms(smsId, urls.id);
      }
      // Logger le resultat
      console.log("upserted URL:", urls);
      body = body.replace(full, `${SHORT_URL}/${urls.slug}`);
    }
    return body;
  } catch (error) {
    logger.error("Error rewriting body with URLs", {
      stack: error.stack || error.message,
    });
    console.error(
      "Error rewriting body with URLs:",
      error.response?.data || error.message
    );
    throw error;
  }
}
