import { sendAdminAlertIncident } from "./monitoring.js";
import dotenv from "dotenv";
import { customAlphabet, nanoid } from "nanoid";
import { query } from "./dbs.js";
dotenv.config();

const { MONITORING_ADD_1, MONITORING_ADD_2 } = process.env;

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
  { code: "ZA", prefix: "+27" }, // Afrique du Sud
  { code: "LR", prefix: "+231" }, // Libéria
  { code: "CH", prefix: "+41" }, // Suisse
  { code: "UK", prefix: "+44" }, // Angleterre (Royaume-Uni)
  { code: "LB", prefix: "+961" }, // Liban
  { code: "US", prefix: "+1" }, // États-Unis
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

    return slug; // { id, slug }
  } catch (err) {
    const data = {
      app: "clyx-sms",
      env: "local",
      status: "error",
      error_type: "UPDATE_URL_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: "amadoungom@agencelycs.com",
      action: "UPSERT URL",
    };
    await sendAdminAlertIncident(data, MONITORING_ADD_1);
    await sendAdminAlertIncident(data, MONITORING_ADD_2);
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
      body = body.replace(full, `${SHORT_URL}/${slugVar}`);
    }
    return body;
  } catch (error) {
    const data = {
      app: "clyx-sms",
      env: "local",
      status: "error",
      error_type: "REWRITTING_BODY_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      action: "REWRITE BODY",
    };
    await sendAdminAlertIncident(data, MONITORING_ADD_1);
    await sendAdminAlertIncident(data, MONITORING_ADD_2);
  }
}
