import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockWalletRepo, mockTxRepo, mockLedgerRepo } = vi.hoisted(() => {
  return {
    mockPrisma: {
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    },
    mockWalletRepo: {
      findWalletByIdAndAccountTx: vi.fn(),
      updateWalletBalance: vi.fn(),
    },
    mockTxRepo: {
      findByReferenceTx: vi.fn(),
      createTransaction: vi.fn(),
      findByIdTx: vi.fn(),
      updateTransactionStatus: vi.fn(),
    },
    mockLedgerRepo: {
      createLedgerEntry: vi.fn(),
    },
  };
});

vi.mock("../../../src/infra/prisma.mjs", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../../src/infra/repositories/wallet.repo.mjs", () => mockWalletRepo);
vi.mock("../../../src/infra/repositories/transactions.repo.mjs", () => mockTxRepo);
vi.mock("../../../src/infra/repositories/ledger.repo.mjs", () => mockLedgerRepo);

import * as txService from "../../../src/services/transaction.service.mjs";

describe("Transaction Service", () => {
  const accountId = "acc-1";
  const walletId = "wal-1";
  const mockWallet = { 
    id: walletId, 
    accountId,
    balance: 1000, 
    currency: "USD",
    account: { status: "ACTIVE" } 
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
  });

  describe("authorize", () => {
    const params = { walletId, accountId, amount: 100, referenceId: "ref-1" };

    it("should create authorize transaction (pending)", async () => {
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(mockWallet);
      mockTxRepo.findByReferenceTx.mockResolvedValue(null);
      mockTxRepo.createTransaction.mockResolvedValue({ id: "tx-1" });

      const result = await txService.authorize(params);
      
      expect(mockTxRepo.createTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "authorize", status: "pending" })
      );
      expect(result.transaction.id).toBe("tx-1");
    });

    it("should fail if wallet not found", async () => {
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(null);
      await expect(txService.authorize(params)).rejects.toThrow("Wallet not found");
    });

    it("should fail if insufficient funds", async () => {
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue({ 
        ...mockWallet, 
        balance: 50 
      });
      await expect(txService.authorize(params)).rejects.toThrow("Insufficient funds");
    });

    it("should fail if duplicate reference", async () => {
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(mockWallet);
      mockTxRepo.findByReferenceTx.mockResolvedValue({ id: "dupe" });
      await expect(txService.authorize(params)).rejects.toThrow("Duplicate reference ID");
    });
  });

  describe("debit", () => {
    const params = { walletId, accountId, amount: 100, referenceId: "ref-d" };

    it("should debit wallet and create completion records", async () => {
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(mockWallet);
      mockTxRepo.findByReferenceTx.mockResolvedValue(null);
      mockWalletRepo.updateWalletBalance.mockResolvedValue({ ...mockWallet, balance: 900 });
      mockTxRepo.createTransaction.mockResolvedValue({ id: "tx-d" });

      const result = await txService.debit(params);

      // Verify balance update
      expect(mockWalletRepo.updateWalletBalance).toHaveBeenCalledWith(
        expect.anything(),
        mockWallet,
        900
      );
      // Verify transaction creation
      expect(mockTxRepo.createTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "debit", status: "completed" })
      );
      // Verify ledger entry
      expect(mockLedgerRepo.createLedgerEntry).toHaveBeenCalled();
      
      expect(result.wallet.balance).toBe(900);
    });

    it("should use default USD currency if missing", async () => {
      const walletNoCurrency = { ...mockWallet, currency: null };
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(walletNoCurrency);
      mockTxRepo.findByReferenceTx.mockResolvedValue(null);
      mockWalletRepo.updateWalletBalance.mockResolvedValue({ ...walletNoCurrency, balance: 900 });
      mockTxRepo.createTransaction.mockResolvedValue({ id: "tx-d" });

      const result = await txService.debit(params);
      expect(result.wallet.balance).toBe(900);
    });

    it("should fail duplicate reference", async () => {
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(mockWallet);
      mockTxRepo.findByReferenceTx.mockResolvedValue({ id: "dupe" });
      await expect(txService.debit(params)).rejects.toThrow("Duplicate reference ID");
    });

    it("should fail if wallet not found", async () => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(null);
        await expect(txService.debit(params)).rejects.toThrow("Wallet not found");
    });
  });

  describe("credit", () => {
    const params = { walletId, accountId, amount: 100, referenceId: "ref-c" };

    it("should credit wallet and create completion records", async () => {
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(mockWallet);
      mockTxRepo.findByReferenceTx.mockResolvedValue(null);
      mockWalletRepo.updateWalletBalance.mockResolvedValue({ ...mockWallet, balance: 1100 });
      mockTxRepo.createTransaction.mockResolvedValue({ id: "tx-c" });

      const result = await txService.credit(params);

      expect(mockWalletRepo.updateWalletBalance).toHaveBeenCalledWith(
        expect.anything(),
        mockWallet,
        1100
      );
      expect(mockTxRepo.createTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "credit", status: "completed" })
      );
      expect(mockLedgerRepo.createLedgerEntry).toHaveBeenCalled();
    });

    it("should use default USD currency if missing", async () => {
      const walletNoCurrency = { ...mockWallet, currency: null };
      mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(walletNoCurrency);
      mockTxRepo.findByReferenceTx.mockResolvedValue(null);
      mockWalletRepo.updateWalletBalance.mockResolvedValue({ ...walletNoCurrency, balance: 1100 });
      mockTxRepo.createTransaction.mockResolvedValue({ id: "tx-c" });

      const result = await txService.credit(params);
      expect(result.wallet.balance).toBe(1100);
    });

    it("should fail duplicate reference", async () => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(mockWallet);
        mockTxRepo.findByReferenceTx.mockResolvedValue({ id: "dupe" });
        await expect(txService.credit(params)).rejects.toThrow("Duplicate reference ID");
    });

    it("should fail if wallet not found", async () => {
        mockWalletRepo.findWalletByIdAndAccountTx.mockResolvedValue(null);
        await expect(txService.credit(params)).rejects.toThrow("Wallet not found");
    });
  });

  describe("reverse (pending)", () => {
    const params = { transactionId: "tx-1", accountId };

    it("should update status to reversed", async () => {
      mockTxRepo.findByIdTx.mockResolvedValue({ 
        id: "tx-1", 
        status: "pending", 
        wallet: { accountId } 
      });
      mockTxRepo.updateTransactionStatus.mockResolvedValue({ id: "tx-1", status: "reversed" });

      const result = await txService.reverse(params);
      expect(mockTxRepo.updateTransactionStatus).toHaveBeenCalledWith(
        expect.anything(),
        "tx-1",
        "reversed"
      );
      expect(result.transaction.status).toBe("reversed");
    });

    it("should fail if not pending", async () => {
      mockTxRepo.findByIdTx.mockResolvedValue({ 
        id: "tx-1", 
        status: "completed", 
        wallet: { accountId } 
      });
      await expect(txService.reverse(params)).rejects.toThrow("Transaction is not pending");
    });

    it("should fail if transaction not found", async () => {
        mockTxRepo.findByIdTx.mockResolvedValue(null);
        await expect(txService.reverse(params)).rejects.toThrow("Transaction not found");
    });

    it("should fail if not owner", async () => {
        mockTxRepo.findByIdTx.mockResolvedValue({ 
            id: "tx-1", 
            wallet: { accountId: "other-account" } 
        });
        await expect(txService.reverse(params)).rejects.toThrow("Transaction not found");
    });
  });

  describe("adminReverse", () => {
    const params = { transactionId: "tx-1", adminId: "a-1", reason: "mistake" };

    it("should satisfy the requirements and fail if already reversed", async () => {
      mockTxRepo.findByIdTx.mockResolvedValue({ status: "reversed" });
      await expect(txService.adminReverse(params)).rejects.toThrow("Transaction already reversed");
    });

    it("should fail if not completed", async () => {
      mockTxRepo.findByIdTx.mockResolvedValue({ status: "pending" });
      await expect(txService.adminReverse(params)).rejects.toThrow("Only completed transactions can be reversed");
    });

    // Valid admin reverse of DEBIT (so we Credit back)
    it("should reverse a debit transaction", async () => {
        mockTxRepo.findByIdTx.mockResolvedValue({ 
            id: "tx-1", 
            amount: 100,
            type: "debit",
            status: "completed", 
            referenceId: "ref-orig",
            wallet: mockWallet 
        });
        
        mockWalletRepo.updateWalletBalance.mockResolvedValue(mockWallet);
        mockTxRepo.createTransaction.mockResolvedValue({ id: "rev-tx-1" });

        await txService.adminReverse(params);

        // Check balance update (credit back)
        expect(mockWalletRepo.updateWalletBalance).toHaveBeenCalledWith(
            expect.anything(),
            mockWallet,
            1100 // 1000 + 100
        );
        // Check reversal tx created
        expect(mockTxRepo.createTransaction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ type: "reverse", referenceId: "REV-ref-orig" })
        );
    });

    // Valid admin reverse of CREDIT (so we Debit back)
    it("should reverse a credit transaction", async () => {
        mockTxRepo.findByIdTx.mockResolvedValue({ 
            id: "tx-1", 
            amount: 100,
            type: "credit",
            status: "completed", 
            referenceId: "ref-orig",
            wallet: mockWallet 
        });

        await txService.adminReverse(params);

        // Check balance update (debit back)
        expect(mockWalletRepo.updateWalletBalance).toHaveBeenCalledWith(
            expect.anything(),
            mockWallet,
            900 // 1000 - 100
        );
    });

    it("should fail reverse credit if insufficient funds", async () => {
        const poorWallet = { ...mockWallet, balance: 50 };
        mockTxRepo.findByIdTx.mockResolvedValue({ 
            id: "tx-1", 
            amount: 100,
            type: "credit",
            status: "completed", 
            wallet: poorWallet 
        });

        await expect(txService.adminReverse(params)).rejects.toThrow("Insufficient balance");
    });

    it("should fail if transaction not found", async () => {
        mockTxRepo.findByIdTx.mockResolvedValue(null);
        await expect(txService.adminReverse(params)).rejects.toThrow("Transaction not found");
    });

    it("should fail if unknown transaction type", async () => {
        mockTxRepo.findByIdTx.mockResolvedValue({ 
            id: "tx-1", 
            type: "unknown",
            status: "completed",
            wallet: mockWallet
        });
        await expect(txService.adminReverse(params)).rejects.toThrow("Cannot reverse this transaction type");
    });
  });
});
