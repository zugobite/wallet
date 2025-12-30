import { prisma } from "../infra/prisma.mjs";
import { v4 as uuid } from "uuid";

export default async function authorize(req, res) {
  try {
    const { walletId, amount, referenceId } = req.body;

    if (!walletId || !amount || !referenceId) {
      return res.status(400).json({
        status: 400,
        code: "BAD_REQUEST",
        error: "Missing required fields: walletId, amount, referenceId",
      });
    }

    // Ensure wallet belongs to authenticated user's account
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, accountId: req.user.account.id },
    });

    if (!wallet) {
      return res.status(404).json({
        status: 404,
        code: "NOT_FOUND",
        error: "Wallet not found",
      });
    }

    if (wallet.balance < amount) {
      return res.status(422).json({
        status: 422,
        code: "INSUFFICIENT_FUNDS",
        error: "Insufficient funds",
      });
    }

    const txn = await prisma.transaction.create({
      data: {
        id: uuid(),
        walletId,
        type: "authorize",
        amount,
        status: "pending",
        referenceId,
      },
    });

    res.status(201).json({
      status: 201,
      code: "CREATED",
      data: txn,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      error: err.message,
    });
  }
}
