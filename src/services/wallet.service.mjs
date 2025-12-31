import { v4 as uuid } from "uuid";
import { prisma } from "../infra/prisma.mjs";
import * as walletRepo from "../infra/repositories/wallet.repo.mjs";
import * as txRepo from "../infra/repositories/transactions.repo.mjs";
import * as ledgerRepo from "../infra/repositories/ledger.repo.mjs";
import { assertWalletActive, canDebit } from "../domain/wallet.mjs";

/**
 * Custom error with status code
 */
class ServiceError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Get wallet by ID for a specific account
 * @param {string} walletId - Wallet ID
 * @param {string} accountId - Account ID for ownership check
 * @returns {Promise<Object>} Wallet data
 */
export async function getWallet(walletId, accountId) {
  const wallet = await walletRepo.findWalletByIdAndAccount(walletId, accountId);

  if (!wallet) {
    throw new ServiceError("Wallet not found", "WALLET_NOT_FOUND", 404);
  }

  return wallet;
}

/**
 * Get wallet balance
 * @param {string} walletId - Wallet ID
 * @param {string} accountId - Account ID for ownership check
 * @returns {Promise<Object>} Balance info
 */
export async function getBalance(walletId, accountId) {
  const wallet = await getWallet(walletId, accountId);

  return {
    walletId: wallet.id,
    currency: wallet.currency,
    balance: wallet.balance,
    availableBalance: wallet.balance, // Future: subtract pending holds
  };
}

/**
 * Deposit funds into a wallet
 * @param {Object} params - Deposit parameters
 * @param {string} params.walletId - Wallet ID
 * @param {string} params.accountId - Account ID for ownership check
 * @param {number} params.amount - Amount to deposit
 * @param {string} params.referenceId - Unique reference ID
 * @returns {Promise<Object>} Transaction and updated wallet
 */
export async function deposit({ walletId, accountId, amount, referenceId }) {
  return prisma.$transaction(async (tx) => {
    // Find wallet with ownership check
    const wallet = await walletRepo.findWalletByIdAndAccountTx(
      tx,
      walletId,
      accountId
    );

    if (!wallet) {
      throw new ServiceError("Wallet not found", "WALLET_NOT_FOUND", 404);
    }

    // Validate wallet is active
    assertWalletActive(wallet);

    // Check for duplicate reference
    const existingTx = await txRepo.findByReferenceTx(tx, referenceId);
    if (existingTx) {
      throw new ServiceError(
        "Duplicate reference ID",
        "DUPLICATE_REFERENCE",
        409
      );
    }

    // Credit the wallet
    const updatedWallet = await walletRepo.creditWallet(
      tx,
      walletId,
      wallet.balance,
      amount
    );

    // Create transaction record
    const transaction = await txRepo.createTransaction(tx, {
      id: uuid(),
      walletId,
      type: "credit",
      amount,
      status: "completed",
      referenceId,
    });

    // Create ledger entry
    await ledgerRepo.createLedgerEntry(tx, {
      id: uuid(),
      transactionId: transaction.id,
      direction: "credit",
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: updatedWallet.balance,
    });

    return { transaction, wallet: updatedWallet };
  });
}

/**
 * Withdraw funds from a wallet
 * @param {Object} params - Withdrawal parameters
 * @param {string} params.walletId - Wallet ID
 * @param {string} params.accountId - Account ID for ownership check
 * @param {number} params.amount - Amount to withdraw
 * @param {string} params.referenceId - Unique reference ID
 * @returns {Promise<Object>} Transaction and updated wallet
 */
export async function withdraw({ walletId, accountId, amount, referenceId }) {
  return prisma.$transaction(async (tx) => {
    // Find wallet with ownership check
    const wallet = await walletRepo.findWalletByIdAndAccountTx(
      tx,
      walletId,
      accountId
    );

    if (!wallet) {
      throw new ServiceError("Wallet not found", "WALLET_NOT_FOUND", 404);
    }

    // Validate wallet is active
    assertWalletActive(wallet);

    // Check for duplicate reference
    const existingTx = await txRepo.findByReferenceTx(tx, referenceId);
    if (existingTx) {
      throw new ServiceError(
        "Duplicate reference ID",
        "DUPLICATE_REFERENCE",
        409
      );
    }

    // Check sufficient balance
    canDebit(wallet, amount);

    // Debit the wallet with optimistic locking
    const updatedWallet = await walletRepo.debitWallet(tx, wallet, amount);

    // Create transaction record
    const transaction = await txRepo.createTransaction(tx, {
      id: uuid(),
      walletId,
      type: "debit",
      amount,
      status: "completed",
      referenceId,
    });

    // Create ledger entry
    await ledgerRepo.createLedgerEntry(tx, {
      id: uuid(),
      transactionId: transaction.id,
      direction: "debit",
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: updatedWallet.balance,
    });

    return { transaction, wallet: updatedWallet };
  });
}

/**
 * Get transactions for a wallet
 * @param {string} walletId - Wallet ID
 * @param {string} accountId - Account ID for ownership check
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Transactions and pagination
 */
export async function getTransactions(walletId, accountId, options = {}) {
  // Verify wallet ownership
  const wallet = await walletRepo.findWalletByIdAndAccount(walletId, accountId);

  if (!wallet) {
    throw new ServiceError("Wallet not found", "WALLET_NOT_FOUND", 404);
  }

  const { page = 1, limit = 20, type, status } = options;

  const [total, transactions] = await Promise.all([
    txRepo.countByWalletId(walletId, { type, status }),
    txRepo.findByWalletId(walletId, { page, limit, type, status }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export { ServiceError };
