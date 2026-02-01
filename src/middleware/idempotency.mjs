/**
 * @fileoverview Idempotency middleware for preventing duplicate transactions.
 * Ensures that operations with the same referenceId cannot be executed multiple times,
 * providing exactly-once semantics for financial operations.
 */

import { prisma } from "../infra/prisma.mjs";

/**
 * Idempotency check middleware.
 * 
 * Validates that a transaction with the given referenceId does not already exist
 * for the authenticated user's account. This prevents duplicate operations when
 * clients retry requests (network failures, timeouts, etc.).
 * 
 * Idempotency is scoped to the account level - different accounts can use the
 * same referenceId without conflict.
 * 
 * @async
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.referenceId - Unique reference ID for the operation
 * @param {Object} req.user - Authenticated user object (injected by auth middleware)
 * @param {Object} req.user.account - User's account information
 * @param {string} req.user.account.id - Account ID for scoping idempotency check
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>} Calls next() if referenceId is unique, or sends error response
 * @throws {400} BAD_REQUEST - Missing referenceId field
 * @throws {409} CONFLICT - Transaction with same referenceId already exists
 */
export async function idempotency(req, res, next) {
  const { referenceId } = req.body;

  if (!referenceId) {
    return res.status(400).json({
      status: 400,
      code: "BAD_REQUEST",
      error: "Missing required field: referenceId",
    });
  }

  // Ensure idempotency is scoped to the user's account
  const exists = await prisma.transaction.findFirst({
    where: {
      referenceId,
      wallet: { accountId: req.user.account.id },
    },
  });

  if (exists) {
    return res.status(409).json({
      status: 409,
      code: "CONFLICT",
      error: "Duplicate transaction: referenceId already exists",
    });
  }

  next();
}
