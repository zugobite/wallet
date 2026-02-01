/**
 * @fileoverview Authorization handler for two-phase debit transactions.
 * Creates a pending authorization that reserves funds without immediately debiting the wallet.
 * This allows for capture/reverse operations after authorization.
 */

import { prisma } from "../infra/prisma.mjs";
import { v4 as uuid } from "uuid";

/**
 * Authorize a debit transaction (two-phase commit - phase 1).
 * 
 * Creates a pending transaction that reserves funds in the wallet without
 * immediately debiting. The authorization can later be captured (completed)
 * or reversed (cancelled).
 * 
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.walletId - ID of the wallet to authorize debit from
 * @param {number} req.body.amount - Amount to authorize (in minor units, e.g., cents)
 * @param {string} req.body.referenceId - Unique reference ID for idempotency
 * @param {Object} req.user - Authenticated user object (injected by auth middleware)
 * @param {Object} req.user.account - User's account information
 * @param {string} req.user.account.id - Account ID for ownership verification
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with transaction details or error
 * @throws {400} BAD_REQUEST - Missing required fields
 * @throws {404} NOT_FOUND - Wallet not found or doesn't belong to user
 * @throws {422} INSUFFICIENT_FUNDS - Wallet balance is less than requested amount
 * @throws {500} INTERNAL_SERVER_ERROR - Database or system error
 */
export default async function authorize(req, res) {
  try {
    const { walletId, amount, referenceId } = req.body;

    if (!walletId || !amount || !referenceId) {
      return res.status(400).json({
        status: 400,
        code: "BAD_REQUEST",
        error: "Missing required fields: walletId, amount, referenceId",
      });
    }

    // Ensure wallet belongs to authenticated user's account
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, accountId: req.user.account.id },
    });

    if (!wallet) {
      return res.status(404).json({
        status: 404,
        code: "NOT_FOUND",
        error: "Wallet not found",
      });
    }

    if (wallet.balance < amount) {
      return res.status(422).json({
        status: 422,
        code: "INSUFFICIENT_FUNDS",
        error: "Insufficient funds",
      });
    }

    const txn = await prisma.transaction.create({
      data: {
        id: uuid(),
        walletId,
        type: "authorize",
        amount,
        status: "pending",
        referenceId,
      },
    });

    res.status(201).json({
      status: 201,
      code: "CREATED",
      data: txn,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      error: err.message,
    });
  }
}
