import { z } from "zod";
import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(["credit", "debit", "authorize", "reverse"]).optional(),
  status: z.enum(["pending", "completed", "reversed"]).optional(),
  walletId: z.string().uuid().optional(),
  minAmount: z.coerce.number().int().optional(),
  maxAmount: z.coerce.number().int().optional(),
});

/**
 * GET /api/v1/admin/transactions
 * List all transactions with pagination (Admin only)
 */
export default async function listTransactions(req, res) {
  try {
    const validation = querySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        status: 400,
        code: "VALIDATION_ERROR",
        error: "Invalid query parameters",
        details: validation.error.issues,
      });
    }

    const { page, limit, type, status, walletId, minAmount, maxAmount } =
      validation.data;

    // Build filter
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (walletId) where.walletId = walletId;
    if (minAmount !== undefined) where.amount = { gte: minAmount };
    if (maxAmount !== undefined) {
      where.amount = { ...where.amount, lte: maxAmount };
    }

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          wallet: {
            select: {
              id: true,
              currency: true,
              account: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
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
          wallet: {
            id: tx.wallet.id,
            currency: tx.wallet.currency,
          },
          user: {
            id: tx.wallet.account.user.id,
            email: tx.wallet.account.user.email,
          },
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
    logger.error({ err }, "Failed to list transactions");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to list transactions",
    });
  }
}
