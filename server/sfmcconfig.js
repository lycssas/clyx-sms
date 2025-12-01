// middleware/verifySfmcJwt.js
import jwt, { decode } from "jsonwebtoken";
import { query } from "./dbs.js";
import { sendAdminAlertIncident } from "./monitoring.js";

const jwtSecret = process.env.JWT_SECRET;

const MONITORING_ADD_1 = process.env.MONITORING_ADD_1;
const MONITORING_ADD_2 = process.env.MONITORING_ADD_2;

export async function verifySfmcJwt(req, res, next) {
  try {
    // Récupérer le token
    let token = null;
    const authHeader = req.headers.authorization || "";

    if (req.headers["content-type"] === "application/jwt") {
      if (Buffer.isBuffer(req.body)) {
        token = req.body.toString("utf8");
      } else {
        token = req.body; // string
      }
    } else if (req.body && req.body.jwt) {
      token = req.body.jwt;
    }

    if (!token) {
      return res.status(401).json({ error: "Missing SFMC JWT" });
    }

    // Décoder SANS vérifier pour récupérer le buid
    const decodedUnverified = jwt.decode(token, { complete: true });

    if (!decodedUnverified || !decodedUnverified.payload) {
      console.error("Unable to decode JWT");
      return res.status(401).json({ error: "Invalid SFMC JWT" });
    }

    const payload = decodedUnverified.payload;

    let buid = null;

    if (Array.isArray(payload.inArguments) && payload.inArguments.length > 0) {
      const inArgs = payload.inArguments[0];
      buid = inArgs.buid || null;

      // Récupérer le jwt_secret pour ce buid en base
      const envResult = await query(
        "SELECT buid, jwt_secret, name FROM users WHERE buid = $1",
        [buid]
      );

      if (envResult.rowCount === 0 || !envResult[0].jwt_secret) {
        console.error("No environment/jwt_secret configured for buid:", buid);
        return res.status(401).json({ error: "Unknown environment" });
      }

      const env = envResult[0];

      // Vérifier le JWT avec le bon secret
      const decodedVerified = jwt.verify(token, env.jwt_secret);

      // Attacher les infos à la requête
      req.sfmcJwt = decodedVerified; // payload vérifié

      next();
    } else {
      next();
    }
  } catch (err) {
    const data = {
      app: "clyx-sms",
      env: "PROD",
      status: "error",
      error_type: "SFMC_JWT_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: null,
      action: "Decode SFMC JWT",
    };
    sendAdminAlertIncident(data, MONITORING_ADD_1);
    sendAdminAlertIncident(data, MONITORING_ADD_2);
    return res.status(401).json({ error: "Invalid SFMC JWT" });
  }
}

export async function initConfig(req, res) {
  const { buid } = req.query;

  if (!buid) {
    return res.status(400).json({ error: "buid is required" });
  }

  try {
    // Récupérer environnement + user
    const envResult = await query(
      `SELECT 
        buid,
        name              AS name,
        is_active         AS is_active,
        id                AS sfmc_user_id,
        role              AS role,
        email             AS email
      FROM users 
      WHERE buid = $1`,
      [buid]
    );

    if (envResult.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Environment not found for this BUID" });
    }

    const env = envResult[0];

    res.json({
      environment: {
        buid: env.buid,
        name: env.name,
        is_active: env.is_active,
      },
      user: "",
      templates: "",
      senderNames: "",
    });
    // console.log("Response:", res);
  } catch (err) {
    const data = {
      app: "clyx-sms",
      env: "PROD",
      status: "error",
      error_type: "INIT_COMPOSANT_ERROR",
      error_message: err.message,
      error_code: err.code || null,
      httpstatus: 500,
      buid: null,
      occured_at: new Date().toISOString(),
      stack_trace: err.stack || null,
      EmailAddress: null,
      action: "Init composant",
    };
    sendAdminAlertIncident(data, MONITORING_ADD_1);
    sendAdminAlertIncident(data, MONITORING_ADD_2);
    res.status(500).json({ error: "Internal server error" });
  }
}
