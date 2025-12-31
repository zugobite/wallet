import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

/**
 * GET /api/v1/wallets/:id
 * Get wallet details
 */
export default async function getWallet(req, res) {
  try {
    const { id } = req.params;

    const wallet = await prisma.wallet.findFirst({
      where: {
        id,
        accountId: req.user.account.id,
      },
      include: {
        account: {
          select: {
            id: true,
            status: true,
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

    return res.status(200).json({
      status: 200,
      data: {
        wallet: {
          id: wallet.id,
          currency: wallet.currency,
          balance: wallet.balance,
          createdAt: wallet.createdAt,
        },
        account: {
          id: wallet.account.id,
          status: wallet.account.status,
        },
      },
    });
  } catch (err) {
    logger.error({ err, walletId: req.params.id }, "Failed to get wallet");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to get wallet",
    });
  }
}
