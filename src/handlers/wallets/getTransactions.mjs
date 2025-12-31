import { z } from "zod";
import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(["credit", "debit", "authorize", "reverse"]).optional(),
  status: z.enum(["pending", "completed", "reversed"]).optional(),
});

/**
 * GET /api/v1/wallets/:id/transactions
 * Get wallet transactions with pagination
 */
export default async function getTransactions(req, res) {
  try {
    const { id } = req.params;

    // Validate query params
    const validation = querySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        status: 400,
        code: "VALIDATION_ERROR",
        error: "Invalid query parameters",
        details: validation.error.issues,
      });
    }

    const { page, limit, type, status } = validation.data;

    // Verify wallet belongs to user
    const wallet = await prisma.wallet.findFirst({
      where: {
        id,
        accountId: req.user.account.id,
      },
      select: { id: true },
    });

    if (!wallet) {
      return res.status(404).json({
        status: 404,
        code: "WALLET_NOT_FOUND",
        error: "Wallet not found",
      });
    }

    // Build filter
    const where = { walletId: id };
    if (type) where.type = type;
    if (status) where.status = status;

    // Get total count and transactions
    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ledger: {
            select: {
              id: true,
              direction: true,
              amount: true,
              balanceBefore: true,
              balanceAfter: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      status: 200,
      data: {
        transactions: transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          referenceId: tx.referenceId,
          createdAt: tx.createdAt,
          ledgerEntries: tx.ledger,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    logger.error(
      { err, walletId: req.params.id },
      "Failed to get transactions"
    );
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to get transactions",
    });
  }
}
