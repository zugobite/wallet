/**
 * @fileoverview Webhook notification service for transaction events.
 * 
 * Provides functionality to:
 * - Register webhook endpoints
 * - Send notifications for transaction events
 * - Handle retries with exponential backoff
 * - Verify webhook signatures
 * 
 * @module infra/webhooks
 */

import crypto from "crypto";
import logger from "./logger.mjs";
import { redis } from "./redis.mjs";

/**
 * Webhook event types
 */
export const WebhookEvents = {
  TRANSACTION_CREATED: "transaction.created",
  TRANSACTION_COMPLETED: "transaction.completed",
  TRANSACTION_REVERSED: "transaction.reversed",
  TRANSACTION_FAILED: "transaction.failed",
  WALLET_CREATED: "wallet.created",
  WALLET_FROZEN: "wallet.frozen",
  WALLET_UNFROZEN: "wallet.unfrozen",
};

/**
 * Generate HMAC signature for webhook payload
 * @param {object} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {string} HMAC signature
 */
function generateSignature(payload, secret) {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac("sha256", secret)
    .update(payloadString)
    .digest("hex");
}

/**
 * Send webhook notification
 * @param {object} options - Webhook options
 * @param {string} options.url - Webhook endpoint URL
 * @param {string} options.event - Event type
 * @param {object} options.data - Event data
 * @param {string} [options.secret] - Webhook secret for signature
 * @param {number} [options.attempt=1] - Current attempt number
 * @returns {Promise<object>} Response object
 */
export async function sendWebhook({ url, event, data, secret, attempt = 1 }) {
  const maxAttempts = 3;
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
    attempt,
  };

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "WalletAPI/1.0",
    "X-Webhook-Event": event,
    "X-Webhook-Attempt": attempt.toString(),
  };

  // Add signature if secret provided
  if (secret) {
    headers["X-Webhook-Signature"] = generateSignature(payload, secret);
  }

  try {
    logger.info({ url, event, attempt }, "Sending webhook notification");

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    logger.info({ url, event, status: response.status }, "Webhook delivered successfully");

    return {
      success: true,
      status: response.status,
      attempt,
    };
  } catch (error) {
    logger.error(
      {
        error: error.message,
        url,
        event,
        attempt,
      },
      "Webhook delivery failed"
    );

    // Retry with exponential backoff
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      logger.info({ url, event, delay, nextAttempt: attempt + 1 }, "Scheduling webhook retry");

      // Schedule retry (in production, use a job queue like BullMQ)
      setTimeout(() => {
        sendWebhook({ url, event, data, secret, attempt: attempt + 1 });
      }, delay);
    }

    return {
      success: false,
      error: error.message,
      attempt,
    };
  }
}

/**
 * Notify registered webhooks for an event
 * @param {string} event - Event type
 * @param {object} data - Event data
 * @param {number} accountId - Account ID to get webhooks for
 */
export async function notifyWebhooks(event, data, accountId) {
  try {
    // Get registered webhooks for this account
    const webhooksKey = `webhooks:${accountId}`;
    const webhooks = await redis.hgetall(webhooksKey);

    if (!webhooks || Object.keys(webhooks).length === 0) {
      logger.debug({ event, accountId }, "No webhooks registered for account");
      return;
    }

    // Send to all registered webhooks
    const promises = Object.entries(webhooks).map(([id, configJson]) => {
      const config = JSON.parse(configJson);
      
      // Check if webhook is subscribed to this event
      if (config.events && !config.events.includes(event)) {
        return Promise.resolve();
      }

      return sendWebhook({
        url: config.url,
        event,
        data,
        secret: config.secret,
      });
    });

    await Promise.allSettled(promises);
  } catch (error) {
    logger.error(
      {
        error: error.message,
        event,
        accountId,
      },
      "Failed to notify webhooks"
    );
  }
}

/**
 * Register a webhook endpoint
 * @param {object} options - Webhook configuration
 * @param {number} options.accountId - Account ID
 * @param {string} options.url - Webhook endpoint URL
 * @param {string[]} [options.events] - Event types to subscribe to
 * @param {string} [options.secret] - Webhook secret for signature verification
 * @returns {Promise<object>} Webhook registration details
 */
export async function registerWebhook({ accountId, url, events, secret }) {
  const webhookId = crypto.randomUUID();
  const webhooksKey = `webhooks:${accountId}`;

  const config = {
    id: webhookId,
    url,
    events: events || Object.values(WebhookEvents),
    secret: secret || crypto.randomBytes(32).toString("hex"),
    createdAt: new Date().toISOString(),
    active: true,
  };

  await redis.hset(webhooksKey, webhookId, JSON.stringify(config));

  logger.info({ accountId, webhookId, url }, "Webhook registered");

  return {
    id: webhookId,
    url: config.url,
    events: config.events,
    secret: config.secret,
  };
}

/**
 * Unregister a webhook endpoint
 * @param {number} accountId - Account ID
 * @param {string} webhookId - Webhook ID
 */
export async function unregisterWebhook(accountId, webhookId) {
  const webhooksKey = `webhooks:${accountId}`;
  await redis.hdel(webhooksKey, webhookId);
  logger.info({ accountId, webhookId }, "Webhook unregistered");
}

/**
 * List registered webhooks for an account
 * @param {number} accountId - Account ID
 * @returns {Promise<array>} List of webhooks
 */
export async function listWebhooks(accountId) {
  const webhooksKey = `webhooks:${accountId}`;
  const webhooks = await redis.hgetall(webhooksKey);

  if (!webhooks) {
    return [];
  }

  return Object.values(webhooks).map((configJson) => {
    const config = JSON.parse(configJson);
    // Don't expose the secret
    return {
      id: config.id,
      url: config.url,
      events: config.events,
      createdAt: config.createdAt,
      active: config.active,
    };
  });
}
