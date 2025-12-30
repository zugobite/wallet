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
    // Load user/account from DB
    const account = await prisma.account.findUnique({
      where: { userId: payload.sub },
    });

    if (!account) {
      return res.status(401).json({
        status: 401,
        code: "UNAUTHORIZED",
        error: "Account not found",
      });
    }

    req.user = { id: payload.sub, account };
    next();
  } catch (err) {
    return res.status(401).json({
      status: 401,
      code: "UNAUTHORIZED",
      error: "Invalid or expired token",
    });
  }
}
