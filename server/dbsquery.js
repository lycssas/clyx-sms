import { query } from "./dbs.js";
/** équivalent de addRecord (pendant /execute) */
export async function insertPending({
  contactKey,
  phone,
  message,
  pushId,
  buid,
  country,
  versionId,
  activityId,
  journeyId,
  campaignName,
  smsName,
  smsId,
  smsCount,
  eventDate
}) {
  const rows = await query(
    `INSERT INTO sms_logs (contact_key, phone, message, push_id, buid, country_code, version_id, activity_id, journey_id, campaign_name, sms_name, sms_id, sms_count, sfmc_event_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      contactKey,
      phone,
      message,
      pushId || null,
      buid || null,
      country || null,
      versionId || null,
      activityId || null,
      journeyId || null,
      campaignName || null,
      smsName || null,
      smsId || null,
      smsCount || null,
      eventDate || null
    ]
  );
  return rows[0];
}

/** retrouver « la » ligne par phone (ex plus récent) */
export async function findLastPendingByPhone(phone) {
  const rows = await query(
    `SELECT *
       FROM sms_logs
      WHERE phone = $1
        AND dlr_status_raw IS NULL
      ORDER BY sent_at DESC
      LIMIT 1`,
    [phone]
  );
  return rows[0] || null;
}

export async function findLastPendingById(id) {
  const rows = await query(
    `SELECT *
       FROM sms_logs
      WHERE id = $1
        AND dlr_status_raw IS NULL`,
    [id]
  );
  return rows[0] || null;
}

/** marquer DLR & prêt pour SFMC */
export async function updateDlrStatus({ id, rawStatus, pushId }) {
  const dlrOk = rawStatus === "6";
  await query(
    `UPDATE sms_logs
        SET dlr_status_raw = $1,
            dlr_ok         = $2,
            push_id       = $3,
            dlr_at         = now()
      WHERE id = $4`,
    [rawStatus, dlrOk, pushId, id]
  );
}

/** récupérer les lignes à pousser vers SFMC (non encore poussées) */
export async function getRowsForSfmc(limit = 1000) {
  return await query(
    `SELECT id, contact_key, dlr_ok
       FROM sms_logs
      WHERE dlr_status_raw IS NOT NULL
        AND pushed_sfmc = FALSE
      LIMIT $1`,
    [limit]
  );
}

/** marquer comme poussées */
export async function markAsPushed(ids) {
  if (!ids.length) return;
  await query(
    `UPDATE sms_logs
        SET pushed_sfmc = TRUE,
            pushed_sfmc_at = now()
      WHERE id = ANY($1::bigint[])`,
    [ids]
  );
}
