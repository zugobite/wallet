import { z } from "zod";
import { v4 as uuid } from "uuid";
import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

const depositSchema = z.object({
  amount: z.number().int().positive("Amount must be a positive integer"),
  referenceId: z.string().min(1, "Reference ID is required"),
  description: z.string().max(255).optional(),
});

/**
 * POST /api/v1/wallets/:id/deposit
 * Deposit funds into a wallet
 */
export default async function deposit(req, res) {
  try {
    const { id } = req.params;

    // Validate request body
    const validation = depositSchema.safeParse(req.body);
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

      // Credit the wallet
      const updatedWallet = await tx.wallet.update({
        where: { id },
        data: { balance: wallet.balance + amount },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          id: uuid(),
          walletId: id,
          type: "credit",
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
          direction: "credit",
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
      "Deposit completed"
    );

    return res.status(200).json({
      status: 200,
      message: "Deposit successful",
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

    logger.error({ err, walletId: req.params.id }, "Deposit failed");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Deposit failed",
    });
  }
}
