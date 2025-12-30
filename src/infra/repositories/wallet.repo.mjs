import { prisma } from "../prisma.mjs";

export async function findWalletById(id) {
  return prisma.wallet.findUnique({
    where: { id },
    include: { account: true },
  });
}

export async function updateWalletBalance(tx, wallet, newBalance) {
  return tx.wallet.update({
    where: { id: wallet.id, version: wallet.version },
    data: {
      balance: newBalance,
      version: { increment: 1 },
    },
  });
}
