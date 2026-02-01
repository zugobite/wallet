/**
 * @fileoverview Debit handler for withdrawing funds from a wallet.
 * Executes a direct debit transaction that immediately decreases the wallet balance.
 * Uses monetra for precise money arithmetic, optimistic locking, and creates ledger entries.
 */

import { prisma } from "../infra/prisma.mjs";
import { v4 as uuid } from "uuid";
import { money } from "monetra";

/**
 * Debit funds from a wallet.
 * 
 * Executes an atomic transaction that:
 * 1. Validates wallet ownership and existence
 * 2. Verifies sufficient funds using precise money comparison
 * 3. Subtracts the specified amount from the wallet balance
 * 4. Uses optimistic locking (version field) to prevent race conditions
 * 5. Creates a completed transaction record
 * 6. Creates a debit ledger entry for audit trail
 * 
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.walletId - ID of the wallet to debit from
 * @param {number} req.body.amount - Amount to debit (in minor units, e.g., cents)
 * @param {string} req.body.referenceId - Unique reference ID for idempotency
 * @param {Object} req.user - Authenticated user object (injected by auth middleware)
 * @param {Object} req.user.account - User's account information
 * @param {string} req.user.account.id - Account ID for ownership verification
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with transaction and updated wallet or error
 * @throws {400} BAD_REQUEST - Missing required fields
 * @throws {404} NOT_FOUND - Wallet not found or doesn't belong to user
 * @throws {422} INSUFFICIENT_FUNDS - Wallet balance is less than requested amount
 * @throws {500} INTERNAL_SERVER_ERROR - Database or system error
 */
export default async function debit(req, res) {
  const { walletId, amount, referenceId } = req.body;

  if (!walletId || !amount || !referenceId) {
    return res.status(400).json({
      status: 400,
      code: "BAD_REQUEST",
      error: "Missing required fields: walletId, amount, referenceId",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { id: walletId, accountId: req.user.account.id },
      });

      if (!wallet) {
        const err = new Error("Wallet not found");
        err.statusCode = 404;
        err.code = "NOT_FOUND";
        throw err;
      }

      const currency = wallet.currency || "USD";
      const balanceM = money(wallet.balance, currency);
      const amountM = money(amount, currency);

      if (balanceM.lessThan(amountM)) {
        const err = new Error("Insufficient funds");
        err.statusCode = 422;
        err.code = "INSUFFICIENT_FUNDS";
        throw err;
      }

      const newBalanceM = balanceM.subtract(amountM);
      const newBalance = Number(newBalanceM.minor);

      const updatedWallet = await tx.wallet.update({
        where: { id: walletId, version: wallet.version },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          id: uuid(),
          walletId,
          type: "debit",
          amount,
          status: "completed",
          referenceId,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          id: uuid(),
          transactionId: transaction.id,
          direction: "debit",
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
        },
      });

      return { transaction, wallet: updatedWallet };
    });

    res.status(200).json({
      status: 200,
      code: "OK",
      data: result,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const code = err.code || "INTERNAL_SERVER_ERROR";
    res.status(statusCode).json({
      status: statusCode,
      code,
      error: err.message,
    });
  }
}
