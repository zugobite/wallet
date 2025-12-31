import { describe, it, expect } from "@jest/globals";
import { assertTransactionPending } from "../../../src/domain/transactions.mjs";

describe("Transaction Domain", () => {
  describe("assertTransactionPending", () => {
    it("should throw error if transaction is null", () => {
      expect(() => assertTransactionPending(null)).toThrow(
        "Transaction not found"
      );
    });

    it("should throw error if transaction is undefined", () => {
      expect(() => assertTransactionPending(undefined)).toThrow(
        "Transaction not found"
      );
    });

    it("should throw error if transaction status is completed", () => {
      const txn = { id: "txn-1", status: "completed" };
      expect(() => assertTransactionPending(txn)).toThrow(
        "Transaction is not pending"
      );
    });

    it("should throw error if transaction status is reversed", () => {
      const txn = { id: "txn-1", status: "reversed" };
      expect(() => assertTransactionPending(txn)).toThrow(
        "Transaction is not pending"
      );
    });

    it("should not throw if transaction status is pending", () => {
      const txn = { id: "txn-1", status: "pending" };
      expect(() => assertTransactionPending(txn)).not.toThrow();
    });
  });
});
