import { prisma } from "../prisma.mjs";

/**
 * Find user by ID
 * @param {string} id - User ID
 * @returns {Promise<Object|null>} User with account
 */
export async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      account: {
        include: {
          wallets: true,
        },
      },
    },
  });
}

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User with account
 */
export async function findByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      account: true,
    },
  });
}

/**
 * Create user with account and default wallet
 * @param {Object} tx - Prisma transaction client
 * @param {Object} data - User data
 * @param {string} data.email - User email
 * @param {string} data.passwordHash - Hashed password
 * @param {string} [data.role='CUSTOMER'] - User role
 * @param {string} [data.currency='USD'] - Default wallet currency
 * @returns {Promise<Object>} Created user with account and wallet
 */
export async function createUserWithAccountAndWallet(tx, data) {
  const { email, passwordHash, role = "CUSTOMER", currency = "USD" } = data;

  return tx.user.create({
    data: {
      email,
      passwordHash,
      role,
      account: {
        create: {
          status: "ACTIVE",
          wallets: {
            create: {
              balance: 0,
              currency,
            },
          },
        },
      },
    },
    include: {
      account: {
        include: {
          wallets: true,
        },
      },
    },
  });
}

/**
 * Find users with pagination
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of users
 */
export async function findMany(options = {}) {
  const { page = 1, limit = 20, role, search } = options;

  const where = {};
  if (role) where.role = role;
  if (search) where.email = { contains: search };

  return prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      account: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          _count: {
            select: { wallets: true },
          },
        },
      },
    },
  });
}

/**
 * Count users
 * @param {Object} options - Filter options
 * @returns {Promise<number>} Count
 */
export async function count(options = {}) {
  const { role, search } = options;

  const where = {};
  if (role) where.role = role;
  if (search) where.email = { contains: search };

  return prisma.user.count({ where });
}
