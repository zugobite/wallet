import { prisma } from "../prisma.mjs";

/**
 * Find account by ID
 * @param {string} id - Account ID
 * @returns {Promise<Object|null>} Account with user
 */
export async function findById(id) {
  return prisma.account.findUnique({
    where: { id },
    include: {
      user: true,
      wallets: true,
    },
  });
}

/**
 * Find account by user ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Account
 */
export async function findByUserId(userId) {
  return prisma.account.findUnique({
    where: { userId },
    include: {
      wallets: true,
    },
  });
}

/**
 * Update account status
 * @param {string} id - Account ID
 * @param {string} status - New status ('ACTIVE' or 'FROZEN')
 * @returns {Promise<Object>} Updated account
 */
export async function updateStatus(id, status) {
  return prisma.account.update({
    where: { id },
    data: { status },
  });
}

/**
 * Freeze an account
 * @param {string} id - Account ID
 * @returns {Promise<Object>} Updated account
 */
export async function freeze(id) {
  return updateStatus(id, "FROZEN");
}

/**
 * Unfreeze an account
 * @param {string} id - Account ID
 * @returns {Promise<Object>} Updated account
 */
export async function unfreeze(id) {
  return updateStatus(id, "ACTIVE");
}
