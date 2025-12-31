import jwt from "jsonwebtoken";
import { prisma } from "../infra/prisma.mjs";

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
