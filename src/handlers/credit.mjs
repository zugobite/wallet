import { prisma } from "../infra/prisma.mjs";
import { v4 as uuid } from "uuid";
import { Money, getCurrency } from "monetra";

export default async function credit(req, res) {
  const { walletId, amount, referenceId } = req.body;

  if (!walletId || !amount || !referenceId) {
    return res.status(400).json({
      status: 400,
      code: "BAD_REQUEST",
      error: "Missing required fields: walletId, amount, referenceId",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { id: walletId, accountId: req.user.account.id },
      });

      if (!wallet) {
        const err = new Error("Wallet not found");
        err.statusCode = 404;
        err.code = "NOT_FOUND";
        throw err;
      }

      const currency = getCurrency(wallet.currency || "USD");
      const balanceM = Money.fromMinor(wallet.balance, currency);
      const amountM = Money.fromMinor(amount, currency);
      const newBalanceM = balanceM.add(amountM);
      const newBalance = Number(newBalanceM.toMinor());

      const updatedWallet = await tx.wallet.update({
        where: { id: walletId },
        data: { balance: newBalance },
      });

      const transaction = await tx.transaction.create({
        data: {
          id: uuid(),
          walletId,
          type: "credit",
          amount,
          status: "completed",
          referenceId,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          id: uuid(),
          transactionId: transaction.id,
          direction: "credit",
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
        },
      });

      return { transaction, wallet: updatedWallet };
    });

    res.status(200).json({
      status: 200,
      code: "OK",
      data: result,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const code = err.code || "INTERNAL_SERVER_ERROR";
    res.status(statusCode).json({
      status: statusCode,
      code,
      error: err.message,
    });
  }
}
