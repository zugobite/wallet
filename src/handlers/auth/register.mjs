import { z } from "zod";
import { registerUser, generateToken } from "../../services/auth.service.mjs";
import { logger } from "../../infra/logger.mjs";

const registerSchema = z.object({
  email: z.email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  currency: z.string().length(3).optional().default("USD"),
});

/**
 * POST /api/v1/auth/register
 * Register a new user account
 */
export default async function register(req, res) {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        status: 400,
        code: "VALIDATION_ERROR",
        error: "Invalid request body",
        details: validation.error.issues,
      });
    }

    const { email, password, currency } = validation.data;

    const user = await registerUser({ email, password, currency });
    const token = generateToken(user);

    logger.info({ userId: user.id, email: user.email }, "User registered");

    return res.status(201).json({
      status: 201,
      message: "User registered successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
        account: {
          id: user.account.id,
          status: user.account.status,
        },
        wallet: {
          id: user.account.wallets[0].id,
          currency: user.account.wallets[0].currency,
          balance: user.account.wallets[0].balance,
        },
        token,
      },
    });
  } catch (err) {
    if (err.code === "EMAIL_EXISTS") {
      return res.status(409).json({
        status: 409,
        code: "EMAIL_EXISTS",
        error: err.message,
      });
    }

    logger.error({ err }, "Registration failed");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Registration failed",
    });
  }
}
