/**
 * @fileoverview Webhook management handlers for registering and managing webhook endpoints.
 * 
 * @module handlers/webhooks
 */

import { StatusCodes } from "http-status-codes";
import logger from "../infra/logger.mjs";
import {
  registerWebhook,
  unregisterWebhook,
  listWebhooks,
  WebhookEvents,
} from "../infra/webhooks.mjs";

/**
 * POST /api/v1/webhooks
 * Register a new webhook endpoint
 */
export async function createWebhook(req, res) {
  try {
    const { url, events, secret } = req.body;

    if (!url) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "MISSING_URL",
        message: "url is required",
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_URL",
        message: "url must be a valid HTTP/HTTPS URL",
      });
    }

    // Validate events if provided
    if (events && Array.isArray(events)) {
      const validEvents = Object.values(WebhookEvents);
      const invalidEvents = events.filter((e) => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: "error",
          code: "INVALID_EVENTS",
          message: `Invalid events: ${invalidEvents.join(", ")}`,
          validEvents,
        });
      }
    }

    const webhook = await registerWebhook({
      accountId: req.user.account.id,
      url,
      events,
      secret,
    });

    logger.info({ accountId: req.user.account.id, webhookId: webhook.id }, "Webhook created");

    return res.status(StatusCodes.CREATED).json({
      status: "success",
      code: "WEBHOOK_CREATED",
      data: webhook,
    });
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
    }, "Failed to create webhook");

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Failed to create webhook",
    });
  }
}

/**
 * GET /api/v1/webhooks
 * List all registered webhooks for the account
 */
export async function getWebhooks(req, res) {
  try {
    const webhooks = await listWebhooks(req.user.account.id);

    return res.status(StatusCodes.OK).json({
      status: "success",
      code: "OK",
      data: webhooks,
    });
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
    }, "Failed to list webhooks");

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Failed to list webhooks",
    });
  }
}

/**
 * DELETE /api/v1/webhooks/:id
 * Delete a webhook endpoint
 */
export async function deleteWebhook(req, res) {
  try {
    const { id } = req.params;

    await unregisterWebhook(req.user.account.id, id);

    logger.info({ accountId: req.user.account.id, webhookId: id }, "Webhook deleted");

    return res.status(StatusCodes.OK).json({
      status: "success",
      code: "WEBHOOK_DELETED",
      message: "Webhook deleted successfully",
    });
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
      webhookId: req.params.id,
    }, "Failed to delete webhook");

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Failed to delete webhook",
    });
  }
}
