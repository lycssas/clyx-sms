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
  campaignCode,
  smsName,
  smsId,
  smsCount,
  eventDate,
}) {
  const rows = await query(
    `INSERT INTO sms_logs (contact_key, phone, message, push_id, buid, country_code, version_id, activity_id, journey_id, campaign_code, sms_name, sms_id, sms_count, sfmc_event_date)
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
      campaignCode || null,
      smsName || null,
      smsId || null,
      smsCount || null,
      eventDate || null,
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
    `SELECT s.id , s.buid, u.sfmc_client_id, u.sfmc_client_secret, u.sfmc_subdomain
      FROM sms_logs s
      JOIN users u ON s.buid = u.buid
      WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/** marquer DLR & prêt pour SFMC */
export async function updateDlrStatus({ id, rawStatus, pushId }) {
  const dlrOk = rawStatus === "6";
  const rep = await query(
    `UPDATE sms_logs
        SET dlr_status_raw = $1,
            dlr_ok         = $2,
            push_id       = $3,
            dlr_at         = now(),
            pushed_sfmc    = true,
            pushed_sfmc_at = now()
      WHERE id = $4`,
    [rawStatus, dlrOk, pushId, id]
  );
}

export async function getSmsToTracking({ id }) {
  const req = `SELECT
    id                        AS "SentId",
    phone                     AS "Phone",
    push_id                   AS "TECH_PushId",
    sent_at                   AS "TECH_SentAtUTC",
    buid                      AS "MID",
    contact_key               AS "ContactKey",
    journey_id                AS "JourneyId",
    version_id                AS "VersionId",
    activity_id               AS "ActivityId",
    campaign_code             AS "CampaignCode",
    sms_name                  AS "SmsName",
    sfmc_event_date           AS "EventDateUtc",
    sms_id                    AS "SmsId"
  FROM sms_logs
  WHERE id = $1`;
  const rows = await query(req, [id]);
  return rows[0] || null;
}
