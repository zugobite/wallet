import { prisma } from "../prisma.mjs";

/**
 * Find wallet by ID
 * @param {string} id - Wallet ID
 * @returns {Promise<Object|null>} Wallet with account
 */
export async function findWalletById(id) {
  return prisma.wallet.findUnique({
    where: { id },
    include: { account: true },
  });
}

/**
 * Find wallet by ID scoped to account
 * @param {string} id - Wallet ID
 * @param {string} accountId - Account ID for ownership check
 * @returns {Promise<Object|null>} Wallet with account
 */
export async function findWalletByIdAndAccount(id, accountId) {
  return prisma.wallet.findFirst({
    where: { id, accountId },
    include: { account: true },
  });
}

/**
 * Find wallet by ID scoped to account (within transaction)
 * @param {Object} tx - Prisma transaction client
 * @param {string} id - Wallet ID
 * @param {string} accountId - Account ID for ownership check
 * @returns {Promise<Object|null>} Wallet with account
 */
export async function findWalletByIdAndAccountTx(tx, id, accountId) {
  return tx.wallet.findFirst({
    where: { id, accountId },
    include: { account: true },
  });
}

/**
 * Find all wallets for an account
 * @param {string} accountId - Account ID
 * @returns {Promise<Array>} List of wallets
 */
export async function findWalletsByAccountId(accountId) {
  return prisma.wallet.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Update wallet balance with optimistic locking
 * @param {Object} tx - Prisma transaction client
 * @param {Object} wallet - Current wallet state
 * @param {number} newBalance - New balance to set
 * @returns {Promise<Object>} Updated wallet
 */
export async function updateWalletBalance(tx, wallet, newBalance) {
  return tx.wallet.update({
    where: { id: wallet.id, version: wallet.version },
    data: {
      balance: newBalance,
      version: { increment: 1 },
    },
  });
}

/**
 * Credit wallet (add funds) - no version check needed
 * @param {Object} tx - Prisma transaction client
 * @param {string} walletId - Wallet ID
 * @param {number} currentBalance - Current balance
 * @param {number} amount - Amount to add
 * @returns {Promise<Object>} Updated wallet
 */
export async function creditWallet(tx, walletId, currentBalance, amount) {
  return tx.wallet.update({
    where: { id: walletId },
    data: { balance: currentBalance + amount },
  });
}

/**
 * Debit wallet (remove funds) with optimistic locking
 * @param {Object} tx - Prisma transaction client
 * @param {Object} wallet - Current wallet state (needs id, version, balance)
 * @param {number} amount - Amount to deduct
 * @returns {Promise<Object>} Updated wallet
 */
export async function debitWallet(tx, wallet, amount) {
  return tx.wallet.update({
    where: { id: wallet.id, version: wallet.version },
    data: {
      balance: wallet.balance - amount,
      version: { increment: 1 },
    },
  });
}

