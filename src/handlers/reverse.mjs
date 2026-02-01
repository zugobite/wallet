/**
 * @fileoverview Reverse handler for cancelling authorized transactions.
 * Marks a previously authorized transaction as reversed, preventing it from being captured.
 * Part of the two-phase commit pattern for debit operations.
 */

import { prisma } from "../infra/prisma.mjs";

/**
 * Reverse an authorized transaction.
 * 
 * Changes the status of a pending authorization to 'reversed', effectively
 * cancelling the reservation of funds. Once reversed, the transaction cannot
 * be captured. This is the cancellation path in the two-phase commit flow.
 * 
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.referenceId - Reference ID of the transaction to reverse
 * @param {Object} req.user - Authenticated user object (injected by auth middleware)
 * @param {Object} req.user.account - User's account information
 * @param {string} req.user.account.id - Account ID for ownership verification
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with reversal confirmation or error
 * @throws {400} BAD_REQUEST - Missing required field (referenceId)
 * @throws {404} NOT_FOUND - Transaction not found or doesn't belong to user
 * @throws {409} CONFLICT - Transaction already reversed
 * @throws {500} INTERNAL_SERVER_ERROR - Database or system error
 */
export default async function reverse(req, res) {
  try {
    const { referenceId } = req.body;

    if (!referenceId) {
      return res.status(400).json({
        status: 400,
        code: "BAD_REQUEST",
        error: "Missing required field: referenceId",
      });
    }

    // Find transaction and ensure it belongs to user's account
    const txn = await prisma.transaction.findFirst({
      where: {
        referenceId,
        wallet: { accountId: req.user.account.id },
      },
    });

    if (!txn) {
      return res.status(404).json({
        status: 404,
        code: "NOT_FOUND",
        error: "Transaction not found",
      });
    }

    if (txn.status === "reversed") {
      return res.status(409).json({
        status: 409,
        code: "CONFLICT",
        error: "Transaction already reversed",
      });
    }

    await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: "reversed" },
    });

    res.status(200).json({
      status: 200,
      code: "OK",
      data: { status: "reversed", referenceId },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      error: err.message,
    });
  }
}
