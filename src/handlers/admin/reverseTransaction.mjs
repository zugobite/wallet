import { z } from "zod";
import { v4 as uuid } from "uuid";
import { Money, getCurrency } from "monetra";
import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

const bodySchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500),
});

/**
 * POST /api/v1/admin/transactions/:id/reverse
 * Reverse a transaction (Admin only)
 * Creates a compensating transaction to restore the balance
 */
export default async function reverseTransaction(req, res) {
  try {
    const { id } = req.params;

    const validation = bodySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        status: 400,
        code: "VALIDATION_ERROR",
        error: "Invalid request body",
        details: validation.error.issues,
      });
    }

    const { reason } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      // Find the transaction
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: {
          wallet: true,
        },
      });

      if (!transaction) {
        const err = new Error("Transaction not found");
        err.statusCode = 404;
        err.code = "TRANSACTION_NOT_FOUND";
        throw err;
      }

      if (transaction.status === "reversed") {
        const err = new Error("Transaction already reversed");
        err.statusCode = 409;
        err.code = "ALREADY_REVERSED";
        throw err;
      }

      if (transaction.status !== "completed") {
        const err = new Error("Only completed transactions can be reversed");
        err.statusCode = 422;
        err.code = "INVALID_STATUS";
        throw err;
      }

      const wallet = transaction.wallet;

      // Calculate new balance based on original transaction type
      const currency = getCurrency(wallet.currency || "USD");
      const balanceM = Money.fromMinor(wallet.balance, currency);
      const amountM = Money.fromMinor(transaction.amount, currency);

      let newBalanceM;
      let reversalType;
      if (transaction.type === "debit") {
        // Debit was subtracted, so add it back
        newBalanceM = balanceM.add(amountM);
        reversalType = "credit";
      } else if (transaction.type === "credit") {
        // Credit was added, so subtract it
        if (balanceM.lessThan(amountM)) {
          const err = new Error(
            "Insufficient balance to reverse credit transaction"
          );
          err.statusCode = 422;
          err.code = "INSUFFICIENT_FUNDS";
          throw err;
        }
        newBalanceM = balanceM.subtract(amountM);
        reversalType = "debit";
      } else {
        const err = new Error("Cannot reverse this transaction type");
        err.statusCode = 422;
        err.code = "INVALID_TRANSACTION_TYPE";
        throw err;
      }

      const newBalance = Number(newBalanceM.toMinor());

      // Update original transaction status
      await tx.transaction.update({
        where: { id },
        data: { status: "reversed" },
      });

      // Update wallet balance with optimistic locking
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id, version: wallet.version },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      // Create reversal transaction
      const reversalTx = await tx.transaction.create({
        data: {
          id: uuid(),
          walletId: wallet.id,
          type: "reverse",
          amount: transaction.amount,
          status: "completed",
          referenceId: `REV-${transaction.referenceId}`,
        },
      });

      // Create ledger entry for reversal
      await tx.ledgerEntry.create({
        data: {
          id: uuid(),
          transactionId: reversalTx.id,
          direction: reversalType,
          amount: transaction.amount,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
        },
      });

      return {
        originalTransaction: transaction,
        reversalTransaction: reversalTx,
        wallet: updatedWallet,
      };
    });

    logger.info(
      {
        adminId: req.user.id,
        originalTxId: id,
        reversalTxId: result.reversalTransaction.id,
        amount: result.originalTransaction.amount,
        reason,
      },
      "Transaction reversed by admin"
    );

    return res.status(200).json({
      status: 200,
      message: "Transaction reversed successfully",
      data: {
        originalTransaction: {
          id: result.originalTransaction.id,
          type: result.originalTransaction.type,
          amount: result.originalTransaction.amount,
          status: "reversed",
        },
        reversalTransaction: {
          id: result.reversalTransaction.id,
          type: result.reversalTransaction.type,
          amount: result.reversalTransaction.amount,
          status: result.reversalTransaction.status,
          referenceId: result.reversalTransaction.referenceId,
        },
        wallet: {
          id: result.wallet.id,
          balance: result.wallet.balance,
          currency: result.wallet.currency,
        },
        reversedBy: req.user.id,
        reason,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        status: err.statusCode,
        code: err.code,
        error: err.message,
      });
    }

    logger.error({ err, transactionId: req.params.id }, "Failed to reverse transaction");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to reverse transaction",
    });
  }
}
