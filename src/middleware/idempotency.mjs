import { prisma } from "../infra/prisma.mjs";

export async function idempotency(req, res, next) {
  const { referenceId } = req.body;

  if (!referenceId) {
    return res.status(400).json({
      status: 400,
      code: "BAD_REQUEST",
      error: "Missing required field: referenceId",
    });
  }

  // Ensure idempotency is scoped to the user's account
  const exists = await prisma.transaction.findFirst({
    where: {
      referenceId,
      wallet: { accountId: req.user.account.id },
    },
  });

  if (exists) {
    return res.status(409).json({
      status: 409,
      code: "CONFLICT",
      error: "Duplicate transaction: referenceId already exists",
    });
  }

  next();
}
