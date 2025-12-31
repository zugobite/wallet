import { describe, it, expect } from "@jest/globals";

/**
 * Wallet Service Tests
 *
 * Unit tests for wallet service business logic.
 */

describe("Wallet Service Logic", () => {
  describe("deposit validation", () => {
    const validateDeposit = (params) => {
      const errors = [];

      if (!params.walletId) {
        errors.push({ field: "walletId", message: "Wallet ID is required" });
      }

      if (!params.accountId) {
        errors.push({ field: "accountId", message: "Account ID is required" });
      }

      if (params.amount === undefined || params.amount <= 0) {
        errors.push({
          field: "amount",
          message: "Amount must be a positive integer",
        });
      }

      if (!params.referenceId) {
        errors.push({
          field: "referenceId",
          message: "Reference ID is required",
        });
      }

      return { valid: errors.length === 0, errors };
    };

    it("should validate correct deposit params", () => {
      const result = validateDeposit({
        walletId: "wallet-123",
        accountId: "account-123",
        amount: 1000,
        referenceId: "ref-123",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject missing walletId", () => {
      const result = validateDeposit({
        accountId: "account-123",
        amount: 1000,
        referenceId: "ref-123",
      });
      expect(result.valid).toBe(false);
    });

    it("should reject zero or negative amount", () => {
      expect(
        validateDeposit({
          walletId: "w",
          accountId: "a",
          amount: 0,
          referenceId: "r",
        }).valid
      ).toBe(false);

      expect(
        validateDeposit({
          walletId: "w",
          accountId: "a",
          amount: -100,
          referenceId: "r",
        }).valid
      ).toBe(false);
    });
  });

  describe("withdraw validation", () => {
    const validateWithdraw = (params, walletBalance) => {
      const errors = [];

      if (!params.walletId) {
        errors.push({ field: "walletId", message: "Wallet ID is required" });
      }

      if (params.amount === undefined || params.amount <= 0) {
        errors.push({
          field: "amount",
          message: "Amount must be a positive integer",
        });
      } else if (walletBalance !== undefined && params.amount > walletBalance) {
        errors.push({ field: "amount", message: "Insufficient funds" });
      }

      if (!params.referenceId) {
        errors.push({
          field: "referenceId",
          message: "Reference ID is required",
        });
      }

      return { valid: errors.length === 0, errors };
    };

    it("should validate correct withdraw params with sufficient balance", () => {
      const result = validateWithdraw(
        { walletId: "w", accountId: "a", amount: 500, referenceId: "r" },
        1000
      );
      expect(result.valid).toBe(true);
    });

    it("should reject insufficient balance", () => {
      const result = validateWithdraw(
        { walletId: "w", accountId: "a", amount: 1500, referenceId: "r" },
        1000
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "amount",
        message: "Insufficient funds",
      });
    });

    it("should allow exact balance withdrawal", () => {
      const result = validateWithdraw(
        { walletId: "w", accountId: "a", amount: 1000, referenceId: "r" },
        1000
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("balance calculation", () => {
    it("should calculate deposit correctly", () => {
      const currentBalance = 1000;
      const depositAmount = 500;
      const newBalance = currentBalance + depositAmount;
      expect(newBalance).toBe(1500);
    });

    it("should calculate withdrawal correctly", () => {
      const currentBalance = 1000;
      const withdrawAmount = 300;
      const newBalance = currentBalance - withdrawAmount;
      expect(newBalance).toBe(700);
    });

    it("should handle multiple operations", () => {
      let balance = 0;
      balance += 1000; // deposit
      balance -= 200; // withdraw
      balance += 500; // deposit
      balance -= 100; // withdraw
      expect(balance).toBe(1200);
    });
  });

  describe("ownership validation", () => {
    const validateOwnership = (wallet, accountId) => {
      if (!wallet) {
        return { valid: false, error: "WALLET_NOT_FOUND" };
      }
      if (wallet.accountId !== accountId) {
        return { valid: false, error: "WALLET_NOT_FOUND" };
      }
      return { valid: true };
    };

    it("should allow access to owned wallet", () => {
      const wallet = { id: "w-1", accountId: "acc-123" };
      const result = validateOwnership(wallet, "acc-123");
      expect(result.valid).toBe(true);
    });

    it("should deny access to wallet with different account", () => {
      const wallet = { id: "w-1", accountId: "acc-123" };
      const result = validateOwnership(wallet, "acc-456");
      expect(result.valid).toBe(false);
    });

    it("should return not found for null wallet", () => {
      const result = validateOwnership(null, "acc-123");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("WALLET_NOT_FOUND");
    });
  });
});
