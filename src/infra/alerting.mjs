import logger from "./logger.mjs";

/**
 * Alerting system for monitoring critical conditions
 * Supports configurable thresholds and alert channels
 */

// Alert state tracking (to prevent alert flooding)
const alertState = new Map();

// Default alert configuration
const defaultConfig = {
  // Error rate threshold (errors per minute)
  errorRateThreshold: 10,

  // High latency threshold (ms)
  latencyThreshold: 5000,

  // Failed auth threshold (failures per minute)
  authFailureThreshold: 20,

  // Alert cooldown period (ms) - prevent duplicate alerts
  cooldownPeriod: 300000, // 5 minutes

  // Channels to send alerts to
  channels: ["log"], // Options: "log", "webhook", "email"

  // Webhook URL for external alerting (e.g., Slack, PagerDuty)
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
};

let config = { ...defaultConfig };

/**
 * Update alerting configuration
 * @param {object} newConfig - New configuration values
 */
export const configure = (newConfig) => {
  config = { ...config, ...newConfig };
};

/**
 * Alert severity levels
 */
export const AlertSeverity = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
};

/**
 * Alert types
 */
export const AlertType = {
  HIGH_ERROR_RATE: "high_error_rate",
  HIGH_LATENCY: "high_latency",
  AUTH_FAILURE_SPIKE: "auth_failure_spike",
  DATABASE_ERROR: "database_error",
  REDIS_ERROR: "redis_error",
  TRANSACTION_FAILURE: "transaction_failure",
  SIGNATURE_ATTACK: "signature_attack",
  INSUFFICIENT_FUNDS_SPIKE: "insufficient_funds_spike",
  SERVICE_DEGRADATION: "service_degradation",
};

/**
 * Check if alert is in cooldown period
 * @param {string} alertKey - Unique alert identifier
 * @returns {boolean} True if in cooldown
 */
const isInCooldown = (alertKey) => {
  const lastAlert = alertState.get(alertKey);
  if (!lastAlert) return false;
  return Date.now() - lastAlert < config.cooldownPeriod;
};

/**
 * Record alert timestamp
 * @param {string} alertKey - Unique alert identifier
 */
const recordAlert = (alertKey) => {
  alertState.set(alertKey, Date.now());
};

/**
 * Send alert to configured channels
 * @param {object} alert - Alert object
 */
const sendToChannels = async (alert) => {
  for (const channel of config.channels) {
    switch (channel) {
      case "log":
        sendToLog(alert);
        break;
      case "webhook":
        await sendToWebhook(alert);
        break;
      case "email":
        // Placeholder for email integration
        logger.debug({ alert }, "Email alerting not implemented");
        break;
    }
  }
};

/**
 * Send alert to logger
 */
const sendToLog = (alert) => {
  const logLevel = alert.severity === AlertSeverity.CRITICAL ? "error" : "warn";
  logger[logLevel](
    {
      alertType: alert.type,
      alertSeverity: alert.severity,
      alertTitle: alert.title,
      alertDetails: alert.details,
      alertTimestamp: alert.timestamp,
    },
    `🚨 ALERT: ${alert.title}`
  );
};

/**
 * Send alert to webhook (Slack, PagerDuty, etc.)
 */
const sendToWebhook = async (alert) => {
  if (!config.webhookUrl) {
    logger.debug("Webhook URL not configured, skipping webhook alert");
    return;
  }

  try {
    const payload = {
      text: `🚨 *${alert.severity.toUpperCase()}*: ${alert.title}`,
      attachments: [
        {
          color:
            alert.severity === AlertSeverity.CRITICAL ? "danger" : "warning",
          fields: [
            { title: "Type", value: alert.type, short: true },
            { title: "Severity", value: alert.severity, short: true },
            { title: "Details", value: JSON.stringify(alert.details, null, 2) },
            { title: "Timestamp", value: alert.timestamp, short: true },
          ],
        },
      ],
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "Failed to send webhook alert");
    }
  } catch (error) {
    logger.error({ error: error.message }, "Error sending webhook alert");
  }
};

/**
 * Trigger an alert
 * @param {string} type - Alert type from AlertType
 * @param {string} severity - Alert severity from AlertSeverity
 * @param {string} title - Human-readable alert title
 * @param {object} details - Additional alert details
 * @param {string} dedupeKey - Optional deduplication key
 */
export const triggerAlert = async (
  type,
  severity,
  title,
  details = {},
  dedupeKey = null
) => {
  const alertKey = dedupeKey || `${type}:${JSON.stringify(details)}`;

  // Check cooldown
  if (isInCooldown(alertKey)) {
    logger.debug({ alertKey }, "Alert suppressed (in cooldown)");
    return false;
  }

  const alert = {
    type,
    severity,
    title,
    details,
    timestamp: new Date().toISOString(),
    alertKey,
  };

  // Record and send
  recordAlert(alertKey);
  await sendToChannels(alert);

  return true;
};

// ============================================================================
// Pre-built Alert Triggers
// ============================================================================

/**
 * Alert on high error rate
 */
export const alertHighErrorRate = async (
  errorCount,
  timeWindowMs,
  details = {}
) => {
  const rate = errorCount / (timeWindowMs / 60000); // errors per minute

  if (rate >= config.errorRateThreshold) {
    await triggerAlert(
      AlertType.HIGH_ERROR_RATE,
      rate >= config.errorRateThreshold * 2
        ? AlertSeverity.CRITICAL
        : AlertSeverity.WARNING,
      `High error rate detected: ${rate.toFixed(1)} errors/min`,
      { errorCount, timeWindowMs, rate, ...details },
      AlertType.HIGH_ERROR_RATE
    );
  }
};

/**
 * Alert on high latency
 */
export const alertHighLatency = async (latencyMs, endpoint, details = {}) => {
  if (latencyMs >= config.latencyThreshold) {
    await triggerAlert(
      AlertType.HIGH_LATENCY,
      latencyMs >= config.latencyThreshold * 2
        ? AlertSeverity.CRITICAL
        : AlertSeverity.WARNING,
      `High latency detected on ${endpoint}: ${latencyMs}ms`,
      { latencyMs, endpoint, ...details }
    );
  }
};

/**
 * Alert on authentication failure spike
 */
export const alertAuthFailureSpike = async (
  failureCount,
  timeWindowMs,
  details = {}
) => {
  const rate = failureCount / (timeWindowMs / 60000);

  if (rate >= config.authFailureThreshold) {
    await triggerAlert(
      AlertType.AUTH_FAILURE_SPIKE,
      AlertSeverity.CRITICAL,
      `Authentication failure spike: ${rate.toFixed(1)} failures/min`,
      { failureCount, timeWindowMs, rate, ...details },
      AlertType.AUTH_FAILURE_SPIKE
    );
  }
};

/**
 * Alert on database errors
 */
export const alertDatabaseError = async (error, operation, details = {}) => {
  await triggerAlert(
    AlertType.DATABASE_ERROR,
    AlertSeverity.CRITICAL,
    `Database error during ${operation}`,
    { error: error.message, operation, ...details }
  );
};

/**
 * Alert on Redis errors
 */
export const alertRedisError = async (error, operation, details = {}) => {
  await triggerAlert(
    AlertType.REDIS_ERROR,
    AlertSeverity.WARNING,
    `Redis error during ${operation}`,
    { error: error.message, operation, ...details }
  );
};

/**
 * Alert on transaction failures
 */
export const alertTransactionFailure = async (
  transactionType,
  reason,
  details = {}
) => {
  await triggerAlert(
    AlertType.TRANSACTION_FAILURE,
    AlertSeverity.WARNING,
    `Transaction failure: ${transactionType} - ${reason}`,
    { transactionType, reason, ...details }
  );
};

/**
 * Alert on potential signature attack (repeated invalid signatures)
 */
export const alertSignatureAttack = async (
  sourceIp,
  failureCount,
  details = {}
) => {
  await triggerAlert(
    AlertType.SIGNATURE_ATTACK,
    AlertSeverity.CRITICAL,
    `Potential signature attack from ${sourceIp}`,
    { sourceIp, failureCount, ...details },
    `signature_attack:${sourceIp}`
  );
};

/**
 * Clear alert cooldown (for testing)
 */
export const clearAlertState = () => {
  alertState.clear();
};

export default {
  configure,
  AlertSeverity,
  AlertType,
  triggerAlert,
  alertHighErrorRate,
  alertHighLatency,
  alertAuthFailureSpike,
  alertDatabaseError,
  alertRedisError,
  alertTransactionFailure,
  alertSignatureAttack,
  clearAlertState,
};
