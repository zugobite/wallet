import { prisma } from "../prisma.mjs";

/**
 * Find transaction by reference ID
 * @param {string} referenceId - Unique reference ID
 * @returns {Promise<Object|null>} Transaction
 */
export async function findByReference(referenceId) {
  return prisma.transaction.findUnique({ where: { referenceId } });
}

/**
 * Find transaction by reference ID (within transaction)
 * @param {Object} tx - Prisma transaction client
 * @param {string} referenceId - Unique reference ID
 * @returns {Promise<Object|null>} Transaction
 */
export async function findByReferenceTx(tx, referenceId) {
  return tx.transaction.findUnique({ where: { referenceId } });
}

/**
 * Find transaction by ID
 * @param {string} id - Transaction ID
 * @returns {Promise<Object|null>} Transaction with wallet
 */
export async function findById(id) {
  return prisma.transaction.findUnique({
    where: { id },
    include: { wallet: true },
  });
}

/**
 * Find transaction by ID (within transaction)
 * @param {Object} tx - Prisma transaction client
 * @param {string} id - Transaction ID
 * @returns {Promise<Object|null>} Transaction with wallet
 */
export async function findByIdTx(tx, id) {
  return tx.transaction.findUnique({
    where: { id },
    include: { wallet: true },
  });
}

/**
 * Create a new transaction
 * @param {Object} tx - Prisma transaction client
 * @param {Object} data - Transaction data
 * @returns {Promise<Object>} Created transaction
 */
export async function createTransaction(tx, data) {
  return tx.transaction.create({ data });
}

/**
 * Update transaction status
 * @param {Object} tx - Prisma transaction client
 * @param {string} id - Transaction ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated transaction
 */
export async function updateTransactionStatus(tx, id, status) {
  return tx.transaction.update({
    where: { id },
    data: { status },
  });
}

/**
 * Find transactions by wallet ID with pagination
 * @param {string} walletId - Wallet ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of transactions
 */
export async function findByWalletId(walletId, options = {}) {
  const { page = 1, limit = 20, type, status } = options;

  const where = { walletId };
  if (type) where.type = type;
  if (status) where.status = status;

  return prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      ledger: true,
    },
  });
}

/**
 * Count transactions by wallet ID
 * @param {string} walletId - Wallet ID
 * @param {Object} options - Filter options
 * @returns {Promise<number>} Count
 */
export async function countByWalletId(walletId, options = {}) {
  const { type, status } = options;

  const where = { walletId };
  if (type) where.type = type;
  if (status) where.status = status;

  return prisma.transaction.count({ where });
}
