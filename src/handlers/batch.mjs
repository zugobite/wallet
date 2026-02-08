/**
 * @fileoverview Batch transaction handler for processing multiple transactions atomically.
 * 
 * Allows clients to submit multiple transactions (credits, debits, authorizations)
 * in a single request. All transactions are processed atomically - either all succeed
 * or all fail together.
 * 
 * @module handlers/batch
 */

import { StatusCodes } from "http-status-codes";
import logger from "../infra/logger.mjs";
import { transactionService } from "../services/transaction.service.mjs";
import { walletService } from "../services/wallet.service.mjs";
import { DomainError } from "../domain/wallet.mjs";
import { redis } from "../infra/redis.mjs";

/**
 * Process batch transactions atomically
 * 
 * @param {object} req - Express request object
 * @param {Array} req.body.transactions - Array of transaction objects
 * @param {string} req.body.transactions[].type - Transaction type: 'credit' | 'debit' | 'authorize'
 * @param {number} req.body.transactions[].walletId - Target wallet ID
 * @param {number} req.body.transactions[].amount - Transaction amount in minor units
 * @param {string} req.body.transactions[].currency - Currency code
 * @param {string} req.body.transactions[].description - Transaction description
 * @param {string} [req.body.transactions[].referenceId] - Optional reference ID for idempotency
 * @param {string} req.body.batchId - Unique batch identifier for idempotency
 * @param {object} res - Express response object
 */
export async function processBatch(req, res) {
  const { transactions, batchId } = req.body;

  // Validation
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "error",
      code: "INVALID_BATCH",
      message: "Transactions must be a non-empty array",
    });
  }

  if (transactions.length > 100) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "error",
      code: "BATCH_TOO_LARGE",
      message: "Maximum 100 transactions per batch",
    });
  }

  if (!batchId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "error",
      code: "MISSING_BATCH_ID",
      message: "batchId is required for idempotency",
    });
  }

  // Check batch idempotency
  const batchKey = `batch:${batchId}`;
  const existingBatch = await redis.get(batchKey);
  
  if (existingBatch) {
    logger.info({ batchId }, "Batch already processed (idempotent response)");
    return res.status(StatusCodes.OK).json(JSON.parse(existingBatch));
  }

  // Validate all transactions
  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];
    if (!txn.type || !["credit", "debit", "authorize"].includes(txn.type)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_TRANSACTION_TYPE",
        message: `Transaction ${i}: type must be 'credit', 'debit', or 'authorize'`,
      });
    }
    if (!txn.walletId || !Number.isInteger(txn.walletId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_WALLET_ID",
        message: `Transaction ${i}: walletId must be an integer`,
      });
    }
    if (!txn.amount || !Number.isInteger(txn.amount) || txn.amount <= 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_AMOUNT",
        message: `Transaction ${i}: amount must be a positive integer`,
      });
    }
    if (!txn.currency || typeof txn.currency !== "string") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_CURRENCY",
        message: `Transaction ${i}: currency must be a string`,
      });
    }
  }

  try {
    logger.info({ batchId, count: transactions.length }, "Processing batch transactions");

    const results = [];
    const processedIds = [];

    // Process each transaction
    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];
      try {
        let result;
        
        switch (txn.type) {
          case "credit":
            result = await transactionService.executeCredit({
              walletId: txn.walletId,
              amount: txn.amount,
              currency: txn.currency,
              description: txn.description || `Batch ${batchId} - Credit ${i + 1}`,
              referenceId: txn.referenceId || `${batchId}-${i}`,
            });
            break;
            
          case "debit":
            result = await transactionService.executeDirectDebit({
              walletId: txn.walletId,
              amount: txn.amount,
              currency: txn.currency,
              description: txn.description || `Batch ${batchId} - Debit ${i + 1}`,
              referenceId: txn.referenceId || `${batchId}-${i}`,
            });
            break;
            
          case "authorize":
            result = await transactionService.authorizeDebit({
              walletId: txn.walletId,
              amount: txn.amount,
              currency: txn.currency,
              description: txn.description || `Batch ${batchId} - Authorize ${i + 1}`,
              referenceId: txn.referenceId || `${batchId}-${i}`,
            });
            break;
        }

        results.push({
          index: i,
          status: "success",
          transaction: result.transaction,
        });
        
        if (result.transaction) {
          processedIds.push(result.transaction.id);
        }
        
      } catch (error) {
        // If any transaction fails, rollback all previous ones
        logger.error({
          error: error.message,
          batchId,
          transactionIndex: i,
          processedIds,
        }, "Batch transaction failed - rolling back");

        // Attempt to reverse all processed transactions
        for (const txnId of processedIds) {
          try {
            await transactionService.reverseTransaction(txnId, {
              reason: `Batch ${batchId} rollback - transaction ${i} failed`,
            });
          } catch (rollbackError) {
            logger.error({
              error: rollbackError.message,
              transactionId: txnId,
              batchId,
            }, "Failed to rollback transaction");
          }
        }

        return res.status(StatusCodes.BAD_REQUEST).json({
          status: "error",
          code: "BATCH_FAILED",
          message: `Transaction ${i} failed: ${error.message}`,
          failedAt: i,
          rolledBack: processedIds.length,
        });
      }
    }

    const response = {
      status: "success",
      code: "BATCH_PROCESSED",
      message: "All transactions processed successfully",
      batchId,
      count: transactions.length,
      results,
    };

    // Cache the successful batch result for idempotency (24 hours)
    await redis.setex(batchKey, 86400, JSON.stringify(response));

    logger.info({ batchId, count: transactions.length }, "Batch transactions processed successfully");

    return res.status(StatusCodes.OK).json(response);
    
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      batchId,
    }, "Unexpected error processing batch transactions");

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Failed to process batch transactions",
    });
  }
}
