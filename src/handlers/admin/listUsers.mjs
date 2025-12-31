import { z } from "zod";
import { prisma } from "../../infra/prisma.mjs";
import { logger } from "../../infra/logger.mjs";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
  search: z.string().max(100).optional(),
});

/**
 * GET /api/v1/admin/users
 * List all users with pagination (Admin only)
 */
export default async function listUsers(req, res) {
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

    const { page, limit, role, search } = validation.data;

    // Build filter
    const where = {};
    if (role) where.role = role;
    if (search) {
      where.email = { contains: search };
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          account: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              _count: {
                select: { wallets: true },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      status: 200,
      data: {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          account: u.account
            ? {
                id: u.account.id,
                status: u.account.status,
                createdAt: u.account.createdAt,
                walletCount: u.account._count.wallets,
              }
            : null,
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
    logger.error({ err }, "Failed to list users");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to list users",
    });
  }
}
