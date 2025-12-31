import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

/**
 * GET /api/v1/wallets/:id/balance
 * Get wallet balance
 */
export default async function getBalance(req, res) {
  try {
    const { id } = req.params;

    const wallet = await prisma.wallet.findFirst({
      where: {
        id,
        accountId: req.user.account.id,
      },
      select: {
        id: true,
        currency: true,
        balance: true,
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
        walletId: wallet.id,
        currency: wallet.currency,
        balance: wallet.balance,
        availableBalance: wallet.balance, // Future: subtract pending holds
      },
    });
  } catch (err) {
    logger.error({ err, walletId: req.params.id }, "Failed to get balance");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to get balance",
    });
  }
}
