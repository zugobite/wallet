import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../infra/prisma.mjs";

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "24h";

/**
 * Hash a plain text password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Register a new user with account and default wallet
 * @param {Object} data - Registration data
 * @param {string} data.email - User email
 * @param {string} data.password - Plain text password
 * @param {string} [data.currency='USD'] - Default wallet currency
 * @returns {Promise<Object>} - Created user with account
 */
export async function registerUser({ email, password, currency = "USD" }) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const error = new Error("Email already registered");
    error.code = "EMAIL_EXISTS";
    error.status = 409;
    throw error;
  }

  const passwordHash = await hashPassword(password);

  // Create user, account, and default wallet in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
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

    return newUser;
  });

  return user;
}

/**
 * Authenticate a user by email and password
 * @param {Object} data - Login data
 * @param {string} data.email - User email
 * @param {string} data.password - Plain text password
 * @returns {Promise<Object>} - User object
 */
export async function authenticateUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      account: true,
    },
  });

  if (!user) {
    const error = new Error("Invalid email or password");
    error.code = "INVALID_CREDENTIALS";
    error.status = 401;
    throw error;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    const error = new Error("Invalid email or password");
    error.code = "INVALID_CREDENTIALS";
    error.status = 401;
    throw error;
  }

  // Check if account is frozen
  if (user.account?.status === "FROZEN") {
    const error = new Error("Account is frozen");
    error.code = "ACCOUNT_FROZEN";
    error.status = 403;
    throw error;
  }

  return user;
}

/**
 * Get user by ID with account and wallets
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - User object or null
 */
export async function getUserById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      account: {
        include: {
          wallets: true,
        },
      },
    },
  });
}
