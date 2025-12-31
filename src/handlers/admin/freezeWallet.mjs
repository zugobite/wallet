import { z } from "zod";
import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

const bodySchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

/**
 * POST /api/v1/admin/wallets/:id/freeze
 * Freeze a wallet's account (Admin only)
 */
export async function freezeWallet(req, res) {
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

    // Find wallet and its account
    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        account: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({
        status: 404,
        code: "WALLET_NOT_FOUND",
        error: "Wallet not found",
      });
    }

    if (wallet.account.status === "FROZEN") {
      return res.status(409).json({
        status: 409,
        code: "ALREADY_FROZEN",
        error: "Account is already frozen",
      });
    }

    // Freeze the account
    const updatedAccount = await prisma.account.update({
      where: { id: wallet.accountId },
      data: { status: "FROZEN" },
    });

    logger.info(
      {
        adminId: req.user.id,
        accountId: wallet.accountId,
        userId: wallet.account.user.id,
        reason,
      },
      "Account frozen by admin"
    );

    return res.status(200).json({
      status: 200,
      message: "Account frozen successfully",
      data: {
        account: {
          id: updatedAccount.id,
          status: updatedAccount.status,
        },
        user: {
          id: wallet.account.user.id,
          email: wallet.account.user.email,
        },
        frozenBy: req.user.id,
        reason: reason || null,
      },
    });
  } catch (err) {
    logger.error({ err, walletId: req.params.id }, "Failed to freeze wallet");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to freeze wallet",
    });
  }
}

/**
 * POST /api/v1/admin/wallets/:id/unfreeze
 * Unfreeze a wallet's account (Admin only)
 */
export async function unfreezeWallet(req, res) {
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

    // Find wallet and its account
    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        account: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({
        status: 404,
        code: "WALLET_NOT_FOUND",
        error: "Wallet not found",
      });
    }

    if (wallet.account.status === "ACTIVE") {
      return res.status(409).json({
        status: 409,
        code: "ALREADY_ACTIVE",
        error: "Account is already active",
      });
    }

    // Unfreeze the account
    const updatedAccount = await prisma.account.update({
      where: { id: wallet.accountId },
      data: { status: "ACTIVE" },
    });

    logger.info(
      {
        adminId: req.user.id,
        accountId: wallet.accountId,
        userId: wallet.account.user.id,
        reason,
      },
      "Account unfrozen by admin"
    );

    return res.status(200).json({
      status: 200,
      message: "Account unfrozen successfully",
      data: {
        account: {
          id: updatedAccount.id,
          status: updatedAccount.status,
        },
        user: {
          id: wallet.account.user.id,
          email: wallet.account.user.email,
        },
        unfrozenBy: req.user.id,
        reason: reason || null,
      },
    });
  } catch (err) {
    logger.error({ err, walletId: req.params.id }, "Failed to unfreeze wallet");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to unfreeze wallet",
    });
  }
}
