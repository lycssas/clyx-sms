import winston from "winston";
import "winston-daily-rotate-file";

// Fichier erreurs PURES (error & fatal)
const errorsTransport = new winston.transports.DailyRotateFile({
  dirname: "logs",
  filename: "error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxSize: "5m",
  maxFiles: "30d",
});

// Fichier warnings + erreurs (warn)
const warnTransport = new winston.transports.DailyRotateFile({
  dirname: "logs",
  filename: "warn-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  level: "warn",
  maxSize: "5m",
  maxFiles: "14d",
});

// Fichier « combined » (tout, de debug à fatal)
const allTransport = new winston.transports.DailyRotateFile({
  dirname: "logs",
  filename: "combined-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  level: "debug", // lowest level ⇒ contient tout
  maxSize: "10m",
  maxFiles: "7d",
});

// Console (pour développement / logs platform-as-a-service)
const consoleTransport = new winston.transports.Console({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.simple(),
});

// Création du logger
export const logger = winston.createLogger({
  levels: winston.config.npm.levels, // { error:0,warn:1,info:2,http:3,verbose:4,debug:5,silly:6 }
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}] ${message}` +
        (Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "")
    )
  ),
  transports: [errorsTransport, warnTransport, allTransport, consoleTransport],
});
