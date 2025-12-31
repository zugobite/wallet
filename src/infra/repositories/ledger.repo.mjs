/**
 * Create a ledger entry
 * @param {Object} tx - Prisma transaction client
 * @param {Object} data - Ledger entry data
 * @returns {Promise<Object>} Created ledger entry
 */
export async function createLedgerEntry(tx, data) {
  return tx.ledgerEntry.create({ data });
}

/**
 * Find ledger entries by transaction ID
 * @param {Object} tx - Prisma transaction client
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Array>} List of ledger entries
 */
export async function findByTransactionId(tx, transactionId) {
  return tx.ledgerEntry.findMany({
    where: { transactionId },
    orderBy: { createdAt: "asc" },
  });
}
