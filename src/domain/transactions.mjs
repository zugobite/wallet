/**
 * Domain error with code and status
 */
class DomainError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Assert that a transaction exists and is in pending status
 * @param {Object} txn - Transaction to check
 * @throws {DomainError} If transaction is null or not pending
 */
export function assertTransactionPending(txn) {
  if (!txn) {
    throw new DomainError(
      "Transaction not found",
      "TRANSACTION_NOT_FOUND",
      404
    );
  }
  if (txn.status !== "pending") {
    throw new DomainError(
      "Transaction is not pending",
      "TRANSACTION_NOT_PENDING",
      422
    );
  }
}

/**
 * Assert that a transaction can be reversed
 * @param {Object} txn - Transaction to check
 * @throws {DomainError} If transaction cannot be reversed
 */
export function assertCanReverse(txn) {
  if (!txn) {
    throw new DomainError(
      "Transaction not found",
      "TRANSACTION_NOT_FOUND",
      404
    );
  }
  if (txn.status === "reversed") {
    throw new DomainError(
      "Transaction already reversed",
      "ALREADY_REVERSED",
      409
    );
  }
  if (txn.status !== "completed") {
    throw new DomainError(
      "Only completed transactions can be reversed",
      "INVALID_STATUS",
      422
    );
  }
}

export { DomainError };

