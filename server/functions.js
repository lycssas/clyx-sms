import { createReadStream, promises as fs } from "fs";
// import readline from "readline";
// import path from "path";
import dotenv from "dotenv";
import { customAlphabet, nanoid } from "nanoid";
import { query } from "./dbs.js";
// import axios from "axios";
import { logger } from "./logger.js";
dotenv.config();

// import { upsertUrl, linkUrlToSms } from "./shortnerfunctions.js";

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
const { SHORT_URL } = process.env;

// Fonction utilitaire pour formatter un numéro au format Orange (+221)
export function formatPhoneNumber(phone) {
  // Supprime tout sauf les chiffres
  let clean = phone.replace(/\D/g, "");

  return `+${clean}`;
}

/* 1) upsert de l'URL -------------------------------------- */
async function upsertUrl(longUrl, smsId) {
  // const slug = await nanoid(5); // Génère un slug candidat
  try {
    const slug = await customAlphabet(
      "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      6
    )();
    // Upsert de l'url dans la base de données
    const rows = await query(
      `INSERT INTO urls (long_url)
VALUES ($1)
ON CONFLICT (long_url) DO UPDATE
  SET long_url = EXCLUDED.long_url
RETURNING id;`,
      [longUrl]
    );
    const urlId = rows[0].id;
    // Link de l'url a l'sms
    const result = await query(
      `INSERT INTO sms_log_urls (sms_id, url_id, slug)
VALUES ($1, $2, $3)
ON CONFLICT (sms_id, url_id) DO UPDATE
  SET slug = sms_log_urls.slug   -- no-op: on conserve le slug existant
RETURNING slug;`,
      [smsId, urlId, slug]
    );
    // console.log(result);

    return slug; // { id, slug }
  } catch (error) {
    console.log(error);
  }
}

/* 2) lier URL ←→ SMS -------------------------------------- */
async function linkUrlToSms(smsId, urlId) {
  await query(
    `INSERT INTO sms_log_urls (sms_id, url_id)
       VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
    [smsId, urlId]
  );
}

export async function rewriteBody(body, smsId) {
  try {
    const URL_RX =
      /((?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:\/[^\s<>"']*)?|www\.(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:\/[^\s<>"']*)?)/gi;
    const matches = [...body.matchAll(URL_RX)];
    for (const [full] of matches) {
      const slugVar = await upsertUrl(full, smsId);
      // Link url to SMS log if smsLogId is provided
      // if (smsId) {
      //   await linkUrlToSms(smsId, urls.id);
      // }
      // Logger le resultat
      // console.log("upserted URL:", slugVar);
      body = body.replace(full, `${SHORT_URL}/${slugVar}`);
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
