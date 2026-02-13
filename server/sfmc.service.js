import dotenv from "dotenv";
import axios from "axios";
import { sendAdminAlertIncident } from "./monitoring.js";
import { getSmsToTracking } from "./dbsquery.js";
import CryptoJS from "crypto-js";
dotenv.config();

const { MC_DE_TRACKING_SMS } = process.env;

const key = CryptoJS.enc.Utf8.parse(
  "erJL5z9hrxOBJwfcJQHNMQeqeqUWoRuccYvNQal2iiE="
);
const iv = CryptoJS.enc.Utf8.parse("SBSaFCV9+aY9c+YkBNHhkw==");

function getDlrStatus(statusCode) {

  switch (statusCode) {
    case "4":
      return "SENT";
    case "6":
      return "DELIVERED";
    case "12":
      return "EXPIRED";
    case "13":
      return "INVALID_PHONE";
    case "14":
      return "NETWORK_ERROR";
    case "15":
      return "ERROR_CREDIT";
    case "16":
      return "UNKNOWN";
    case "23":
      return "REJECTED";
    case "2":
      return "UNDELIVERED";
    default:
      return "FAILED";
  }
}

async function getMcToken(clientId, clientSecret, subdomain, accountId) {
  let token,
    tokenExp = 0;
  const now = Date.now();
  if (token && now < tokenExp) return token; // token encore valable

  const clientIdDecrypted = CryptoJS.AES.decrypt(clientId, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const clientSecretDecrypted = CryptoJS.AES.decrypt(clientSecret, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const url = `https://${subdomain}.auth.marketingcloudapis.com/v2/token`;
  const { data } = await axios.post(url, {
    client_id: clientIdDecrypted.toString(CryptoJS.enc.Utf8),
    client_secret: clientSecretDecrypted.toString(CryptoJS.enc.Utf8),
    account_id: accountId,
    grant_type: "client_credentials",
  });

  token = data.access_token;
  tokenExp = now + (data.expires_in - 60) * 1000; // marge de 60 s
  return token;
}

async function upsertRows(
  rows,
  deKey,
  clientId,
  clientSecret,
  subdomain,
  accountId
) {
  try {
    const accessToken = await getMcToken(
      clientId,
      clientSecret,
      subdomain,
      accountId
    );
    const url = `https://${subdomain}.rest.marketingcloudapis.com/data/v1/async/dataextensions/key:${deKey}/rows`;
    const res = await axios.put(url, rows, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (err) {
    // console.log("Error upserting rows to SFMC: ", err);
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

export async function flushTrackingSMS({
  id,
  push_id,
  status,
  smscount,
  clientId,
  clientSecret,
  subdomain,
  accountId,
}) {
  try {
    const row = await getSmsToTracking({ id });

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
          DeliveryStatus: getDlrStatus(status),
          MID: row.MID,
          ContactKey: row.ContactKey,
          JourneyId: row.JourneyId,
          VersionId: row.VersionId,
          ActivityId: row.ActivityId,
          CampaignCode: row.CampaignCode,
          SmsName: row.SmsName,
          EventDateUtc: row.EventDateUtc,
          SmsId: row.SmsId,
          SmsCount: smscount,
        },
      ],
    };

    const rep = await upsertRows(
      payload,
      MC_DE_TRACKING_SMS,
      clientId,
      clientSecret,
      subdomain,
      accountId
    );
    return rep;
  } catch (err) {
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
