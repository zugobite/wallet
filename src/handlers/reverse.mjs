import { prisma } from "../infra/prisma.mjs";

export default async function reverse(req, res) {
  try {
    const { referenceId } = req.body;

    if (!referenceId) {
      return res.status(400).json({
        status: 400,
        code: "BAD_REQUEST",
        error: "Missing required field: referenceId",
      });
    }

    // Find transaction and ensure it belongs to user's account
    const txn = await prisma.transaction.findFirst({
      where: {
        referenceId,
        wallet: { accountId: req.user.account.id },
      },
    });

    if (!txn) {
      return res.status(404).json({
        status: 404,
        code: "NOT_FOUND",
        error: "Transaction not found",
      });
    }

    if (txn.status === "reversed") {
      return res.status(409).json({
        status: 409,
        code: "CONFLICT",
        error: "Transaction already reversed",
      });
    }

    await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: "reversed" },
    });

    res.status(200).json({
      status: 200,
      code: "OK",
      data: { status: "reversed", referenceId },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      error: err.message,
    });
  }
}
