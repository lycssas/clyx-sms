import dotenv from "dotenv";
import axios from "axios";
import { sendAdminAlertIncident } from "./monitoring.js";
import { getSmsToTracking } from "./dbsquery.js";
dotenv.config();

const {
  MC_SUBDOMAIN,
  MC_DEFINITION_KEY,
  MC_CLIENT_ID,
  MC_CLIENT_SECRET,
  MC_ACCOUNT_ID,
  MC_DE_TRACKING_SMS,
} = process.env;

async function getMcToken() {
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
}

async function upsertRows(rows, deKey) {
  try {
    const accessToken = await getMcToken();
    const url = `https://${MC_SUBDOMAIN}.rest.marketingcloudapis.com/data/v1/async/dataextensions/key:${deKey}/rows`;
    const res = await axios.put(url, rows, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (err) {
    console.log("Error upserting rows to SFMC: ", err);
    const data = {
      app: "clyx-sms",
      status: "error",
      error_type: "SFMC_UPSERT_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: null,
      action: "UPSERT_ROWS",
    };
    await sendAdminAlertIncident(data);
  }
}

export async function flushTrackingSMS({ id, push_id, status }) {
  try {
    const row = await getSmsToTracking({ id });

    // console.log("Upsert tracking row :  ", row);

    if (!row) return;

    const payload = {
      items: [
        {
          SentId: row.SentId,
          Phone: row.Phone,
          TECH_PushId: push_id,
          TECH_SentAtUTC: row.TECH_SentAtUTC,
          IsDelivered: status === "6" ? true : false,
          DeliveryDateUTC: new Date().toISOString(),
          DeliveryStatus: status === "6" ? "Delivered" : "Failed",
          MID: row.MID,
          ContactKey: row.ContactKey,
          JourneyId: row.JourneyId,
          VersionId: row.VersionId,
          ActivityId: row.ActivityId,
          CampaignCode: row.CampaignCode,
          SmsName: row.SmsName,
          EventDateUtc: row.EventDateUtc,
          SmsId: row.SmsId,
        },
      ],
    };

    // console.log("Payload for SFMC tracking SMS: ", payload);

    // console.log("MC_DE_TRACKING_SMS: ", MC_DE_TRACKING_SMS);

    const rep = await upsertRows(payload, MC_DE_TRACKING_SMS);

    console.log("SFMC tracking SMS upsert response: ", rep);
  } catch (err) {
    console.log("Error flushing tracking SMS to SFMC: ", err);
    const data = {
      app: "clyx-sms",
      status: "error",
      error_type: "SFMC_TRACKING_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: null,
      action: "FLUSH_TRACKING_SMS",
    };
    await sendAdminAlertIncident(data);
  }
}
