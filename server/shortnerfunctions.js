import { customAlphabet, nanoid } from "nanoid";
import { query } from "./dbs.js";

/* 1) upsert de l'URL -------------------------------------- */
export async function upsertUrl(longUrl) {
  // const slug = await nanoid(5); // Génère un slug candidat
  const slug = await customAlphabet(
    "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    6
  )();
  const rows = await query(
    `INSERT INTO urls (slug, long_url)
       VALUES ($1,$2)
       ON CONFLICT (long_url)
       DO UPDATE SET slug = urls.slug
     RETURNING id, slug`,
    [slug, longUrl]
  );
  return rows[0]; // { id, slug }
}

/* 2) lier URL ←→ SMS -------------------------------------- */
export async function linkUrlToSms(smsId, urlId) {
  await query(
    `INSERT INTO sms_log_urls (sms_id, url_id)
       VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
    [smsId, urlId]
  );
}

/* 3) récupérer URL via slug -------------------------------- */
export async function getUrlBySlug(slug) {
  const rows = await query("SELECT id, long_url FROM urls WHERE slug = $1", [
    slug,
  ]);
  return rows[0]; // undefined si 404
}

/* 4) incrémenter le compteur ------------------------------ */
export async function incrementClicks(urlId) {
  await query("UPDATE urls SET clicks = clicks + 1 WHERE id = $1", [urlId]);
}

/* 5) log du clic ------------------------------------------ */
export async function logClick({ urlId, region, city, deviceType, ipHash }) {
  await query(
    `INSERT INTO url_clicks 
       (sms_url_id, region, city, device_type, ip_hash)
     VALUES ($1,$2,$3,$4,$5)`,
    [urlId, region, city, deviceType, ipHash]
  );
}

/* 6) récupérer sms_log_id depuis l'URL --------------------- */
export async function getSmsLogId(urlId) {
  const rows = await query(
    "SELECT sms_id FROM sms_log_urls WHERE url_id = $1 LIMIT 1",
    [urlId]
  );
  return rows[0]?.sms_id;
}
