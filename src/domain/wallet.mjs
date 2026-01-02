import { Money, getCurrency } from "monetra";

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
 * Assert that a wallet exists and is active (not frozen)
 * @param {Object} wallet - Wallet with account
 * @throws {DomainError} If wallet is null or account is frozen
 */
export function assertWalletActive(wallet) {
  if (!wallet) {
    throw new DomainError("Wallet not found", "WALLET_NOT_FOUND", 404);
  }
  if (wallet.account?.status === "FROZEN") {
    throw new DomainError("Account is frozen", "ACCOUNT_FROZEN", 403);
  }
}

/**
 * Validate that a debit operation can be performed
 * @param {Object} wallet - Wallet to debit
 * @param {number} amount - Amount to debit
 * @throws {DomainError} If amount is invalid or insufficient funds
 */
export function canDebit(wallet, amount) {
  const currency = getCurrency(wallet.currency);
  const amountMoney = Money.fromMinor(amount, currency);
  const balanceMoney = Money.fromMinor(wallet.balance, currency);

  if (amountMoney.isNegative() || amountMoney.isZero()) {
    throw new DomainError(
      "Amount must be positive",
      "INVALID_AMOUNT",
      400
    );
  }
  if (balanceMoney.lessThan(amountMoney)) {
    throw new DomainError(
      "Insufficient funds",
      "INSUFFICIENT_FUNDS",
      422
    );
  }
}

/**
 * Validate that a credit operation can be performed
 * @param {number} amount - Amount to credit
 * @param {string} currencyCode - Currency code
 * @throws {DomainError} If amount is invalid
 */
export function canCredit(amount, currencyCode = "USD") {
  const currency = getCurrency(currencyCode);
  const amountMoney = Money.fromMinor(amount, currency);

  if (amountMoney.isNegative() || amountMoney.isZero()) {
    throw new DomainError(
      "Amount must be positive",
      "INVALID_AMOUNT",
      400
    );
  }
}

export { DomainError };

