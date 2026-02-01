/**
 * @fileoverview Authentication middleware for JWT token verification.
 * Validates Bearer tokens, verifies JWT signatures, loads user data from database,
 * and ensures account is active before allowing access to protected routes.
 */

import jwt from "jsonwebtoken";
import { prisma } from "../infra/prisma.mjs";

/**
 * Authentication middleware.
 * 
 * Extracts and verifies JWT token from Authorization header, loads the user
 * and their account from the database, and attaches user object to req.user.
 * Also validates that the account is not frozen.
 * 
 * @async
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Request headers
 * @param {string} req.headers.authorization - Bearer token (format: "Bearer <token>")
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>} Calls next() on success, or sends error response
 * @throws {401} UNAUTHORIZED - Missing, invalid, or expired token
 * @throws {401} UNAUTHORIZED - User not found in database
 * @throws {403} FORBIDDEN - Account is frozen
 */
export default async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: 401,
      code: "UNAUTHORIZED",
      error: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Load user with account from DB
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        account: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        status: 401,
        code: "UNAUTHORIZED",
        error: "User not found",
      });
    }

    // Check if account is frozen
    if (user.account?.status === "FROZEN") {
      return res.status(403).json({
        status: 403,
        code: "ACCOUNT_FROZEN",
        error: "Account is frozen",
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      account: user.account,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      status: 401,
      code: "UNAUTHORIZED",
      error: "Invalid or expired token",
    });
  }
}
