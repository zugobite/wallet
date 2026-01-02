import { z } from "zod";
import { v4 as uuid } from "uuid";
import { money } from "monetra";
import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

const withdrawSchema = z.object({
  amount: z.number().int().positive("Amount must be a positive integer"),
  referenceId: z.string().min(1, "Reference ID is required"),
  description: z.string().max(255).optional(),
});

/**
 * POST /api/v1/wallets/:id/withdraw
 * Withdraw funds from a wallet
 */
export default async function withdraw(req, res) {
  try {
    const { id } = req.params;

    // Validate request body
    const validation = withdrawSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        status: 400,
        code: "VALIDATION_ERROR",
        error: "Invalid request body",
        details: validation.error.issues,
      });
    }

    const { amount, referenceId } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      // Verify wallet belongs to user
      const wallet = await tx.wallet.findFirst({
        where: {
          id,
          accountId: req.user.account.id,
        },
        include: {
          account: true,
        },
      });

      if (!wallet) {
        const err = new Error("Wallet not found");
        err.statusCode = 404;
        err.code = "WALLET_NOT_FOUND";
        throw err;
      }

      // Check account is not frozen
      if (wallet.account.status === "FROZEN") {
        const err = new Error("Account is frozen");
        err.statusCode = 403;
        err.code = "ACCOUNT_FROZEN";
        throw err;
      }

      // Check for duplicate reference
      const existingTx = await tx.transaction.findUnique({
        where: { referenceId },
      });

      if (existingTx) {
        const err = new Error("Duplicate reference ID");
        err.statusCode = 409;
        err.code = "DUPLICATE_REFERENCE";
        throw err;
      }

      // Check sufficient balance
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

      // Debit the wallet with optimistic locking
      const updatedWallet = await tx.wallet.update({
        where: { id, version: wallet.version },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          id: uuid(),
          walletId: id,
          type: "debit",
          amount,
          status: "completed",
          referenceId,
        },
      });

      // Create ledger entry
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

    logger.info(
      {
        userId: req.user.id,
        walletId: id,
        amount,
        transactionId: result.transaction.id,
      },
      "Withdrawal completed"
    );

    return res.status(200).json({
      status: 200,
      message: "Withdrawal successful",
      data: {
        transaction: {
          id: result.transaction.id,
          type: result.transaction.type,
          amount: result.transaction.amount,
          status: result.transaction.status,
          referenceId: result.transaction.referenceId,
          createdAt: result.transaction.createdAt,
        },
        wallet: {
          id: result.wallet.id,
          balance: result.wallet.balance,
          currency: result.wallet.currency,
        },
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

    logger.error({ err, walletId: req.params.id }, "Withdrawal failed");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Withdrawal failed",
    });
  }
}
