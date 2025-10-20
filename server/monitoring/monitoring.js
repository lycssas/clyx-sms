import dotenv from "dotenv";
import axios from "axios";
import { nanoid } from "nanoid";
dotenv.config();

const {
  MC_SUBDOMAIN,
  MC_DEFINITION_KEY,
  MC_CLIENT_ID,
  MC_CLIENT_SECRET,
  MC_ACCOUNT_ID,
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

export async function sendAdminAlertIncident(data, admin_email) {
  try {
    const messageKey = await nanoid(16);
    const mcToken = await getMcToken();
    const payload = {
      definitionKey: MC_DEFINITION_KEY,
      recipient: {
        contactKey: messageKey,
        to: admin_email,
        attributes: {
          app: data.app,
          env: data.env,
          status: data.status,
          error_type: data.error_type,
          error_message: data.error_message,
          error_code: data.error_code,
          httpstatus: data.httpstatus,
          buid: data.buid,
          occured_at: data.occured_at,
          stack_trace: data.stack_trace,
          SubscriberKey: messageKey,
          EmailAddress: admin_email,
          action: data.action,
        },
      },
    };

    // const body = JSON.stringify(payload);
    console.log("Admin alert....");

    const url = `https://${MC_SUBDOMAIN}.rest.marketingcloudapis.com/messaging/v1/email/messages/${messageKey}`;

    const response = await axios.post(url, payload, {
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${mcToken}`,
      },
    });
  } catch (error) {
    // logger.error("Error sending email alert:", error);
    console.log("L'erreur vient d'ici");
  }
}
