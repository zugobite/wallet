import { z } from "zod";
import {
  authenticateUser,
  generateToken,
} from "../../services/auth.service.mjs";
import { logger } from "../../infra/logger.mjs";

const loginSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * POST /api/v1/auth/login
 * Authenticate user and return JWT token
 */
export default async function login(req, res) {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        status: 400,
        code: "VALIDATION_ERROR",
        error: "Invalid request body",
        details: validation.error.issues,
      });
    }

    const { email, password } = validation.data;

    const user = await authenticateUser({ email, password });
    const token = generateToken(user);

    logger.info({ userId: user.id, email: user.email }, "User logged in");

    return res.status(200).json({
      status: 200,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        account: user.account
          ? {
              id: user.account.id,
              status: user.account.status,
            }
          : null,
        token,
      },
    });
  } catch (err) {
    if (err.code === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        status: 401,
        code: "INVALID_CREDENTIALS",
        error: err.message,
      });
    }

    if (err.code === "ACCOUNT_FROZEN") {
      return res.status(403).json({
        status: 403,
        code: "ACCOUNT_FROZEN",
        error: err.message,
      });
    }

    logger.error({ err }, "Login failed");
    return res.status(500).json({
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Login failed",
    });
  }
}
