import { z } from "zod";
import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  currency: z.string().length(3).optional(),
  minBalance: z.coerce.number().int().optional(),
  maxBalance: z.coerce.number().int().optional(),
  accountStatus: z.enum(["ACTIVE", "FROZEN"]).optional(),
});

/**
 * GET /api/v1/admin/wallets
 * List all wallets with pagination (Admin only)
 */
export default async function listWallets(req, res) {
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

    const { page, limit, currency, minBalance, maxBalance, accountStatus } =
      validation.data;

    // Build filter
    const where = {};
    if (currency) where.currency = currency;
    if (minBalance !== undefined) where.balance = { gte: minBalance };
    if (maxBalance !== undefined) {
      where.balance = { ...where.balance, lte: maxBalance };
    }
    if (accountStatus) {
      where.account = { status: accountStatus };
    }

    const [total, wallets] = await Promise.all([
      prisma.wallet.count({ where }),
      prisma.wallet.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          account: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: { txns: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      status: 200,
      data: {
        wallets: wallets.map((w) => ({
          id: w.id,
          currency: w.currency,
          balance: w.balance,
          version: w.version,
          createdAt: w.createdAt,
          transactionCount: w._count.txns,
          account: {
            id: w.account.id,
            status: w.account.status,
          },
          user: {
            id: w.account.user.id,
            email: w.account.user.email,
          },
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
    logger.error({ err }, "Failed to list wallets");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to list wallets",
    });
  }
}
