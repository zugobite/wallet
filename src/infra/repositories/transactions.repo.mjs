import { prisma } from "../prisma.mjs";

export async function findByReference(referenceId) {
  return prisma.transaction.findUnique({ where: { referenceId } });
}

export async function createTransaction(tx, data) {
  return tx.transaction.create({ data });
}
