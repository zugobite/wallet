import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockWalletRepo, mockTxRepo, mockLedgerRepo } = vi.hoisted(() => {
  return {
    mockPrisma: {
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    },
    mockWalletRepo: {
      findWalletByIdAndAccount: vi.fn(),
      findWalletByIdAndAccountTx: vi.fn(),
      updateWalletBalance: vi.fn(),
    },
    mockTxRepo: {
      findByReferenceTx: vi.fn(),
      createTransaction: vi.fn(), // Fixed name from createTransactionTx
      createTransactionTx: vi.fn(), 
      countByWalletId: vi.fn(),
      findByWalletId: vi.fn(),
    },
    mockLedgerRepo: {
      createLedgerEntry: vi.fn(),
      createEntryTx: vi.fn(),
    },
  };
});

vi.mock("../../../src/infra/prisma.mjs", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../../src/infra/repositories/wallet.repo.mjs", () => mockWalletRepo);
vi.mock("../../../src/infra/repositories/transactions.repo.mjs", () => mockTxRepo);
vi.mock("../../../src/infra/repositories/ledger.repo.mjs", () => mockLedgerRepo);

import * as walletService from "../../../src/services/wallet.service.mjs";

describe("Wallet Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-bind the transaction mock if needed, but the hoisted one should work
    // We can't access mockPrisma inside the hoisted factory recursively easily,
    // so we trust the setup.
    mockPrisma.$transaction.mockImplementation(async (cb) => {
       // Pass a dummy object representing the tx client, 
       // but since our repo mocks are global, we just need to ensure the callback runs.
       return cb(mockPrisma);
    });
  });

  describe("getWallet", () => {
    const walletId = "wallet-1";
    const accountId = "account-1";

    it("should return wallet if found", async () => {
      const mockWallet = { id: walletId, balance: 100 };
      mockWalletRepo.findWalletByIdAndAccount.mockResolvedValue(mockWallet);

      const result = await walletService.getWallet(walletId, accountId);
      expect(result).toBe(mockWallet);
      expect(mockWalletRepo.findWalletByIdAndAccount).toHaveBeenCalledWith(walletId, accountId);
    });

    it("should throw 404 if not found", async () => {
      mockWalletRepo.findWalletByIdAndAccount.mockResolvedValue(null);

      await expect(walletService.getWallet(walletId, accountId))
        .rejects.toThrow("Wallet not found");
    });
  });

  describe("getBalance", () => {
    const walletId = "wallet-1";
    const accountId = "account-1";

    it("should return formatted balance", async () => {
        const mockWallet = { id: walletId, balance: 500, currency: "USD" };
        mockWalletRepo.findWalletByIdAndAccount.mockResolvedValue(mockWallet);

        const result = await walletService.getBalance(walletId, accountId);
        expect(result).toEqual({
            walletId,
            currency: "USD",
            balance: 500,
            availableBalance: 500
        });
    });
  });

  describe("deposit", () => {
    const params = {
      walletId: "w-1",
      accountId: "a-1",
      amount: 100,
      referenceId: "ref-1",
    };

    const mockWallet = { 
        id: "w-1", 
        balance: 1000, 
        currency: "USD",
        account: { status: "ACTIVE" } 
    };

    beforeEach(() => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(mockWallet);
        mockTxRepo.findByReferenceTx.mockResolvedValue(null);
        mockWalletRepo.updateWalletBalance.mockResolvedValue({ ...mockWallet, balance: 1100 });
        mockTxRepo.createTransaction.mockResolvedValue({ id: "tx-1", status: "COMPLETED" });
    });

    it("should process deposit successfully", async () => {
        const result = await walletService.deposit(params);

        expect(mockWalletRepo.findWalletByIdAndAccountTx).toHaveBeenCalled();
        expect(mockTxRepo.findByReferenceTx).toHaveBeenCalled();
        expect(mockWalletRepo.updateWalletBalance).toHaveBeenCalledWith(
            expect.anything(),
            mockWallet,
            1100 // 1000 + 100
        );
        expect(mockTxRepo.createTransaction).toHaveBeenCalled(); 
        expect(mockLedgerRepo.createLedgerEntry).toHaveBeenCalled();
        expect(result.transaction.status).toBe("COMPLETED");
    });

    it("should throw if wallet not found", async () => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(null);
        await expect(walletService.deposit(params))
            .rejects.toThrow("Wallet not found");
    });

    it("should throw if account is frozen", async () => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue({
            ...mockWallet,
            account: { status: "FROZEN" }
        });
        await expect(walletService.deposit(params))
            .rejects.toThrow("Account is frozen");
    });

    it("should throw if duplicate reference", async () => {
        mockTxRepo.findByReferenceTx.mockResolvedValue({ id: "tx-existing" });
        await expect(walletService.deposit(params))
            .rejects.toThrow("Duplicate reference ID");
    });
  });

  describe("withdraw", () => {
    const params = {
      walletId: "w-1",
      accountId: "a-1",
      amount: 100,
      referenceId: "ref-1",
    };

    const mockWallet = { 
        id: "w-1", 
        balance: 1000, 
        currency: "USD",
        account: { status: "ACTIVE" } 
    };

    beforeEach(() => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(mockWallet);
        mockTxRepo.findByReferenceTx.mockResolvedValue(null);
        mockWalletRepo.updateWalletBalance.mockResolvedValue({ ...mockWallet, balance: 900 });
        mockTxRepo.createTransaction.mockResolvedValue({ id: "tx-2", status: "COMPLETED" });
    });

    it("should process withdraw successfully", async () => {
        const result = await walletService.withdraw(params);

        expect(mockWalletRepo.updateWalletBalance).toHaveBeenCalledWith(
            expect.anything(),
            mockWallet,
            900 // 1000 - 100
        );
        expect(result.transaction.id).toBe("tx-2");
    });

    it("should fail if duplicate reference", async () => {
        mockTxRepo.findByReferenceTx.mockResolvedValue({ id: "tx-existing" });
        await expect(walletService.withdraw(params))
            .rejects.toThrow("Duplicate reference ID");
    });

    it("should fail if insufficient funds", async () => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue({ 
            ...mockWallet, 
            balance: 50 // less than 100
        });
        
        await expect(walletService.withdraw(params))
            .rejects.toThrow("Insufficient funds");
    });

    it("should fail if wallet not found", async () => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(null);
        await expect(walletService.withdraw(params))
            .rejects.toThrow("Wallet not found");
    });
  });

  describe("getTransactions", () => {
    const walletId = "w-1";
    const accountId = "a-1";
    const mockWallet = { id: walletId, accountId };

    beforeEach(() => {
        mockWalletRepo.findWalletByIdAndAccount.mockResolvedValue(mockWallet);
    });

    it("should return transactions with pagination", async () => {
        mockTxRepo.countByWalletId.mockResolvedValue(55);
        mockTxRepo.findByWalletId.mockResolvedValue([{ id: "tx-1" }, { id: "tx-2" }]);

        const result = await walletService.getTransactions(walletId, accountId, { page: 2, limit: 10 });

        expect(result).toEqual({
            transactions: [{ id: "tx-1" }, { id: "tx-2" }],
            pagination: {
                total: 55,
                page: 2,
                limit: 10,
                totalPages: 6,
                hasNext: true,
                hasPrev: true
            }
        });
    });

    it("should throw if wallet not found", async () => {
        mockWalletRepo.findWalletByIdAndAccount.mockResolvedValue(null);
        await expect(walletService.getTransactions(walletId, accountId))
            .rejects.toThrow("Wallet not found");
    });
  });
});
