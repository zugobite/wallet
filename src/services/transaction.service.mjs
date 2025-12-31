import { v4 as uuid } from "uuid";
import { prisma } from "../infra/prisma.mjs";
import * as walletRepo from "../infra/repositories/wallet.repo.mjs";
import * as txRepo from "../infra/repositories/transactions.repo.mjs";
import * as ledgerRepo from "../infra/repositories/ledger.repo.mjs";
import { assertWalletActive, canDebit } from "../domain/wallet.mjs";
import { assertTransactionPending } from "../domain/transactions.mjs";

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
 * Authorize a transaction (pre-authorization without actual debit)
 * @param {Object} params - Authorization parameters
 * @param {string} params.walletId - Wallet ID
 * @param {string} params.accountId - Account ID for ownership check
 * @param {number} params.amount - Amount to authorize
 * @param {string} params.referenceId - Unique reference ID
 * @returns {Promise<Object>} Transaction record
 */
export async function authorize({ walletId, accountId, amount, referenceId }) {
  return prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.findWalletByIdAndAccountTx(
      tx,
      walletId,
      accountId
    );

    if (!wallet) {
      throw new ServiceError("Wallet not found", "WALLET_NOT_FOUND", 404);
    }

    assertWalletActive(wallet);
    canDebit(wallet, amount);

    // Check for duplicate reference
    const existingTx = await txRepo.findByReferenceTx(tx, referenceId);
    if (existingTx) {
      throw new ServiceError(
        "Duplicate reference ID",
        "DUPLICATE_REFERENCE",
        409
      );
    }

    // Create pending transaction (no balance change yet)
    const transaction = await txRepo.createTransaction(tx, {
      id: uuid(),
      walletId,
      type: "authorize",
      amount,
      status: "pending",
      referenceId,
    });

    return { transaction, wallet };
  });
}

/**
 * Debit funds from a wallet
 * @param {Object} params - Debit parameters
 * @param {string} params.walletId - Wallet ID
 * @param {string} params.accountId - Account ID for ownership check
 * @param {number} params.amount - Amount to debit
 * @param {string} params.referenceId - Unique reference ID
 * @returns {Promise<Object>} Transaction and updated wallet
 */
export async function debit({ walletId, accountId, amount, referenceId }) {
  return prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.findWalletByIdAndAccountTx(
      tx,
      walletId,
      accountId
    );

    if (!wallet) {
      throw new ServiceError("Wallet not found", "WALLET_NOT_FOUND", 404);
    }

    assertWalletActive(wallet);
    canDebit(wallet, amount);

    // Check for duplicate reference
    const existingTx = await txRepo.findByReferenceTx(tx, referenceId);
    if (existingTx) {
      throw new ServiceError(
        "Duplicate reference ID",
        "DUPLICATE_REFERENCE",
        409
      );
    }

    // Debit the wallet
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
 * Credit funds to a wallet
 * @param {Object} params - Credit parameters
 * @param {string} params.walletId - Wallet ID
 * @param {string} params.accountId - Account ID for ownership check
 * @param {number} params.amount - Amount to credit
 * @param {string} params.referenceId - Unique reference ID
 * @returns {Promise<Object>} Transaction and updated wallet
 */
export async function credit({ walletId, accountId, amount, referenceId }) {
  return prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.findWalletByIdAndAccountTx(
      tx,
      walletId,
      accountId
    );

    if (!wallet) {
      throw new ServiceError("Wallet not found", "WALLET_NOT_FOUND", 404);
    }

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
 * Reverse a pending transaction
 * @param {Object} params - Reverse parameters
 * @param {string} params.transactionId - Transaction ID to reverse
 * @param {string} params.accountId - Account ID for ownership check
 * @returns {Promise<Object>} Updated transaction
 */
export async function reverse({ transactionId, accountId }) {
  return prisma.$transaction(async (tx) => {
    const transaction = await txRepo.findByIdTx(tx, transactionId);

    if (!transaction) {
      throw new ServiceError(
        "Transaction not found",
        "TRANSACTION_NOT_FOUND",
        404
      );
    }

    // Verify ownership
    if (transaction.wallet.accountId !== accountId) {
      throw new ServiceError(
        "Transaction not found",
        "TRANSACTION_NOT_FOUND",
        404
      );
    }

    assertTransactionPending(transaction);

    // Update transaction status
    const updatedTx = await txRepo.updateTransactionStatus(
      tx,
      transactionId,
      "reversed"
    );

    return { transaction: updatedTx };
  });
}

/**
 * Admin reverse a completed transaction (restores balance)
 * @param {Object} params - Reverse parameters
 * @param {string} params.transactionId - Transaction ID to reverse
 * @param {string} params.adminId - Admin performing the reversal
 * @param {string} params.reason - Reason for reversal
 * @returns {Promise<Object>} Original and reversal transactions
 */
export async function adminReverse({ transactionId, adminId, reason }) {
  return prisma.$transaction(async (tx) => {
    const transaction = await txRepo.findByIdTx(tx, transactionId);

    if (!transaction) {
      throw new ServiceError(
        "Transaction not found",
        "TRANSACTION_NOT_FOUND",
        404
      );
    }

    if (transaction.status === "reversed") {
      throw new ServiceError(
        "Transaction already reversed",
        "ALREADY_REVERSED",
        409
      );
    }

    if (transaction.status !== "completed") {
      throw new ServiceError(
        "Only completed transactions can be reversed",
        "INVALID_STATUS",
        422
      );
    }

    const wallet = transaction.wallet;

    // Calculate new balance based on original transaction type
    let newBalance;
    let reversalType;

    if (transaction.type === "debit") {
      newBalance = wallet.balance + transaction.amount;
      reversalType = "credit";
    } else if (transaction.type === "credit") {
      if (wallet.balance < transaction.amount) {
        throw new ServiceError(
          "Insufficient balance to reverse credit transaction",
          "INSUFFICIENT_FUNDS",
          422
        );
      }
      newBalance = wallet.balance - transaction.amount;
      reversalType = "debit";
    } else {
      throw new ServiceError(
        "Cannot reverse this transaction type",
        "INVALID_TRANSACTION_TYPE",
        422
      );
    }

    // Update original transaction status
    await txRepo.updateTransactionStatus(tx, transactionId, "reversed");

    // Update wallet balance
    const updatedWallet = await walletRepo.updateWalletBalance(
      tx,
      wallet,
      newBalance
    );

    // Create reversal transaction
    const reversalTx = await txRepo.createTransaction(tx, {
      id: uuid(),
      walletId: wallet.id,
      type: "reverse",
      amount: transaction.amount,
      status: "completed",
      referenceId: `REV-${transaction.referenceId}`,
    });

    // Create ledger entry
    await ledgerRepo.createLedgerEntry(tx, {
      id: uuid(),
      transactionId: reversalTx.id,
      direction: reversalType,
      amount: transaction.amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
    });

    return {
      originalTransaction: { ...transaction, status: "reversed" },
      reversalTransaction: reversalTx,
      wallet: updatedWallet,
    };
  });
}

export { ServiceError };
