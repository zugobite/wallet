import { assertWalletActive, canDebit, canCredit, DomainError } from "../../../src/domain/wallet.mjs";

describe("Wallet Domain", () => {
  describe("DomainError", () => {
    it("should create error with code and status", () => {
      const err = new DomainError("msg", "CODE", 400);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("msg");
      expect(err.code).toBe("CODE");
      expect(err.statusCode).toBe(400);
    });
  });

  describe("assertWalletActive", () => {
    it("should throw error if wallet is null", () => {
      expect(() => assertWalletActive(null)).toThrow("Wallet not found");
    });

    it("should throw error if wallet is undefined", () => {
      expect(() => assertWalletActive(undefined)).toThrow("Wallet not found");
    });

    it("should throw error if account is frozen", () => {
      const wallet = {
        id: "wallet-1",
        balance: 1000,
        account: { status: "FROZEN" },
      };
      expect(() => assertWalletActive(wallet)).toThrow("Account is frozen");
    });

    it("should not throw for active wallet", () => {
      const wallet = {
        id: "wallet-1",
        balance: 1000,
        account: { status: "active" },
      };
      expect(() => assertWalletActive(wallet)).not.toThrow();
    });

    it("should not throw if account status is undefined", () => {
      const wallet = {
        id: "wallet-1",
        balance: 1000,
      };
      expect(() => assertWalletActive(wallet)).not.toThrow();
    });
  });

  describe("canDebit", () => {
    it("should throw error for zero amount", () => {
      const wallet = { balance: 1000, currency: "USD" };
      expect(() => canDebit(wallet, 0)).toThrow("Amount must be positive");
    });

    it("should throw error for negative amount", () => {
      const wallet = { balance: 1000, currency: "USD" };
      expect(() => canDebit(wallet, -100)).toThrow("Amount must be positive");
    });

    it("should throw error for insufficient balance", () => {
      const wallet = { balance: 500, currency: "USD" };
      expect(() => canDebit(wallet, 1000)).toThrow("Insufficient funds");
    });

    it("should not throw for valid debit", () => {
      const wallet = { balance: 1000, currency: "USD" };
      expect(() => canDebit(wallet, 500)).not.toThrow();
    });

    it("should not throw when amount equals balance", () => {
      const wallet = { balance: 1000, currency: "USD" };
      expect(() => canDebit(wallet, 1000)).not.toThrow();
    });
  });

  describe("canCredit", () => {
    it("should throw error for zero amount", () => {
      expect(() => canCredit(0)).toThrow("Amount must be positive");
    });

    it("should throw error for negative amount", () => {
      expect(() => canCredit(-100)).toThrow("Amount must be positive");
    });

    it("should not throw for positive amount", () => {
      expect(() => canCredit(100)).not.toThrow();
    });

    it("should accept custom currency", () => {
      expect(() => canCredit(100, "EUR")).not.toThrow();
    });
  });
});
