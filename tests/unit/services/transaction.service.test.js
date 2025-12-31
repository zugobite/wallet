import { describe, it, expect } from "@jest/globals";

/**
 * Transaction Service Tests
 *
 * Unit tests for transaction service business logic.
 */

describe("Transaction Service Logic", () => {
  describe("authorize validation", () => {
    const validateAuthorize = (params, walletBalance) => {
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

    it("should validate correct authorize params", () => {
      const result = validateAuthorize(
        { walletId: "w", amount: 500, referenceId: "r" },
        1000
      );
      expect(result.valid).toBe(true);
    });

    it("should reject amount exceeding balance", () => {
      const result = validateAuthorize(
        { walletId: "w", amount: 1500, referenceId: "r" },
        1000
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("debit validation", () => {
    const validateDebit = (params, walletBalance) => {
      const errors = [];

      if (params.amount > walletBalance) {
        errors.push({ field: "amount", message: "Insufficient funds" });
      }

      return { valid: errors.length === 0, errors };
    };

    it("should allow debit within balance", () => {
      expect(validateDebit({ amount: 500 }, 1000).valid).toBe(true);
    });

    it("should reject debit exceeding balance", () => {
      expect(validateDebit({ amount: 1500 }, 1000).valid).toBe(false);
    });
  });

  describe("credit validation", () => {
    const validateCredit = (params) => {
      const errors = [];

      if (params.amount <= 0) {
        errors.push({
          field: "amount",
          message: "Amount must be positive",
        });
      }

      return { valid: errors.length === 0, errors };
    };

    it("should accept positive amounts", () => {
      expect(validateCredit({ amount: 1000 }).valid).toBe(true);
    });

    it("should reject zero or negative amounts", () => {
      expect(validateCredit({ amount: 0 }).valid).toBe(false);
      expect(validateCredit({ amount: -100 }).valid).toBe(false);
    });
  });

  describe("reverse validation", () => {
    const validateReverse = (transaction) => {
      if (!transaction) {
        return { valid: false, code: "TRANSACTION_NOT_FOUND" };
      }

      if (transaction.status === "reversed") {
        return { valid: false, code: "ALREADY_REVERSED" };
      }

      if (transaction.status !== "completed") {
        return { valid: false, code: "INVALID_STATUS" };
      }

      return { valid: true };
    };

    it("should allow reversing completed transaction", () => {
      const tx = { id: "tx-1", status: "completed", type: "debit" };
      expect(validateReverse(tx).valid).toBe(true);
    });

    it("should reject reversing already reversed transaction", () => {
      const tx = { id: "tx-1", status: "reversed", type: "debit" };
      const result = validateReverse(tx);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("ALREADY_REVERSED");
    });

    it("should reject reversing pending transaction", () => {
      const tx = { id: "tx-1", status: "pending", type: "authorize" };
      const result = validateReverse(tx);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_STATUS");
    });

    it("should reject null transaction", () => {
      const result = validateReverse(null);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("TRANSACTION_NOT_FOUND");
    });
  });

  describe("reversal balance calculation", () => {
    const calculateReversalBalance = (transaction, currentBalance) => {
      if (transaction.type === "debit") {
        // Debit was subtracted, add it back
        return currentBalance + transaction.amount;
      } else if (transaction.type === "credit") {
        // Credit was added, subtract it
        return currentBalance - transaction.amount;
      }
      return null; // Cannot reverse other types
    };

    it("should restore balance for reversed debit", () => {
      const tx = { type: "debit", amount: 500 };
      const currentBalance = 500;
      const newBalance = calculateReversalBalance(tx, currentBalance);
      expect(newBalance).toBe(1000);
    });

    it("should reduce balance for reversed credit", () => {
      const tx = { type: "credit", amount: 500 };
      const currentBalance = 1500;
      const newBalance = calculateReversalBalance(tx, currentBalance);
      expect(newBalance).toBe(1000);
    });

    it("should return null for non-reversible types", () => {
      const tx = { type: "authorize", amount: 500 };
      const newBalance = calculateReversalBalance(tx, 1000);
      expect(newBalance).toBe(null);
    });
  });

  describe("duplicate reference detection", () => {
    const checkDuplicate = (referenceId, existingRefs) => {
      return existingRefs.includes(referenceId);
    };

    it("should detect duplicate reference", () => {
      const existingRefs = ["ref-001", "ref-002", "ref-003"];
      expect(checkDuplicate("ref-002", existingRefs)).toBe(true);
    });

    it("should allow new reference", () => {
      const existingRefs = ["ref-001", "ref-002", "ref-003"];
      expect(checkDuplicate("ref-004", existingRefs)).toBe(false);
    });
  });

  describe("ledger entry generation", () => {
    const createLedgerData = (transaction, wallet, newBalance) => {
      return {
        transactionId: transaction.id,
        direction: transaction.type === "debit" ? "debit" : "credit",
        amount: transaction.amount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
      };
    };

    it("should create correct debit ledger entry", () => {
      const tx = { id: "tx-1", type: "debit", amount: 500 };
      const wallet = { balance: 1000 };
      const newBalance = 500;

      const ledger = createLedgerData(tx, wallet, newBalance);

      expect(ledger.direction).toBe("debit");
      expect(ledger.balanceBefore).toBe(1000);
      expect(ledger.balanceAfter).toBe(500);
    });

    it("should create correct credit ledger entry", () => {
      const tx = { id: "tx-1", type: "credit", amount: 500 };
      const wallet = { balance: 1000 };
      const newBalance = 1500;

      const ledger = createLedgerData(tx, wallet, newBalance);

      expect(ledger.direction).toBe("credit");
      expect(ledger.balanceBefore).toBe(1000);
      expect(ledger.balanceAfter).toBe(1500);
    });
  });
});
