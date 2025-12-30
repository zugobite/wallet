import pino from "pino";
import { randomUUID } from "crypto";

/**
 * Structured logger with correlation ID support
 * Uses Pino for high-performance JSON logging
 */

const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

// Base logger configuration
const baseConfig = {
  level: logLevel,
  base: {
    service: "wallet-api",
    version: process.env.npm_package_version || "1.0.0",
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-signature']",
      "password",
      "secret",
      "token",
      "*.password",
      "*.secret",
      "*.token",
    ],
    remove: true,
  },
};

// Development: pretty print, Production: JSON
const logger = isProduction
  ? pino(baseConfig)
  : pino({
      ...baseConfig,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    });

/**
 * Generate a new correlation ID
 * @returns {string} UUID v4
 */
export const generateCorrelationId = () => randomUUID();

/**
 * Create a child logger with correlation ID
 * @param {string} correlationId - Request correlation ID
 * @param {object} additionalContext - Additional context to include
 * @returns {pino.Logger} Child logger instance
 */
export const createRequestLogger = (correlationId, additionalContext = {}) => {
  return logger.child({
    correlationId,
    ...additionalContext,
  });
};

/**
 * Log levels with structured context
 */
export const LogContext = {
  /**
   * Create transaction log context
   */
  transaction: (transactionId, type, walletId, amount) => ({
    transactionId,
    transactionType: type,
    walletId,
    amount: Number(amount),
  }),

  /**
   * Create authentication log context
   */
  auth: (accountId, success, reason = null) => ({
    accountId,
    authSuccess: success,
    ...(reason && { authFailReason: reason }),
  }),

  /**
   * Create error log context
   */
  error: (error, additionalInfo = {}) => ({
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    ...additionalInfo,
  }),

  /**
   * Create HTTP request log context
   */
  http: (req) => ({
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get("user-agent"),
    ip: req.ip || req.connection?.remoteAddress,
  }),

  /**
   * Create database operation log context
   */
  database: (operation, table, duration = null) => ({
    dbOperation: operation,
    dbTable: table,
    ...(duration !== null && { durationMs: duration }),
  }),
};

/**
 * Audit logger for security-sensitive operations
 */
export const auditLog = {
  /**
   * Log successful authentication
   */
  authSuccess: (correlationId, accountId, method = "jwt") => {
    logger.info(
      {
        correlationId,
        auditType: "AUTH_SUCCESS",
        accountId,
        authMethod: method,
      },
      "Authentication successful"
    );
  },

  /**
   * Log failed authentication
   */
  authFailure: (correlationId, reason, details = {}) => {
    logger.warn(
      {
        correlationId,
        auditType: "AUTH_FAILURE",
        failReason: reason,
        ...details,
      },
      "Authentication failed"
    );
  },

  /**
   * Log transaction events
   */
  transaction: (correlationId, event, transactionData) => {
    logger.info(
      {
        correlationId,
        auditType: `TXN_${event.toUpperCase()}`,
        ...transactionData,
      },
      `Transaction ${event}`
    );
  },

  /**
   * Log signature validation
   */
  signatureValidation: (correlationId, valid, reason = null) => {
    const level = valid ? "info" : "warn";
    logger[level](
      {
        correlationId,
        auditType: valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID",
        ...(reason && { reason }),
      },
      `Signature validation ${valid ? "passed" : "failed"}`
    );
  },

  /**
   * Log security events
   */
  securityEvent: (correlationId, event, details = {}) => {
    logger.warn(
      {
        correlationId,
        auditType: "SECURITY_EVENT",
        securityEvent: event,
        ...details,
      },
      `Security event: ${event}`
    );
  },
};

export default logger;
