import { getUserById } from "../../services/auth.service.mjs";
import { logger } from "../../infra/logger.mjs";

/**
 * GET /api/v1/auth/me
 * Get current authenticated user profile
 */
export default async function me(req, res) {
  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 404,
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    return res.status(200).json({
      status: 200,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        account: user.account
          ? {
              id: user.account.id,
              status: user.account.status,
              createdAt: user.account.createdAt,
            }
          : null,
        wallets:
          user.account?.wallets.map((w) => ({
            id: w.id,
            currency: w.currency,
            balance: w.balance,
            createdAt: w.createdAt,
          })) || [],
      },
    });
  } catch (err) {
    logger.error({ err, userId: req.user?.id }, "Failed to get user profile");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to get user profile",
    });
  }
}
