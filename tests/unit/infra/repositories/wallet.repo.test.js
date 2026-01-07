import { describe, it, expect, vi, beforeEach } from "vitest";
import * as walletRepo from "../../../../src/infra/repositories/wallet.repo.mjs";

const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            wallet: {
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                findMany: vi.fn(),
                update: vi.fn(),
            }
        }
    };
});

vi.mock("../../../../src/infra/prisma.mjs", () => ({
    prisma: mockPrisma
}));

describe("Wallet Repository", () => {
    
    // Mock transaction object
    const mockTx = {
        wallet: {
            findFirst: vi.fn(),
            update: vi.fn()
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockTx.wallet.findFirst.mockReset();
        mockTx.wallet.update.mockReset();
    });

    describe("findWalletById", () => {
        it("should call findUnique with correct args", async () => {
            mockPrisma.wallet.findUnique.mockResolvedValue({ id: "1" });
            const result = await walletRepo.findWalletById("1");
            expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
                where: { id: "1" },
                include: { account: true }
            });
            expect(result).toEqual({ id: "1" });
        });
    });

    describe("findWalletByIdAndAccount", () => {
        it("should call findFirst with correct args", async () => {
            mockPrisma.wallet.findFirst.mockResolvedValue({ id: "1" });
            const result = await walletRepo.findWalletByIdAndAccount("1", "acc-1");
            expect(mockPrisma.wallet.findFirst).toHaveBeenCalledWith({
                where: { id: "1", accountId: "acc-1" },
                include: { account: true }
            });
            expect(result).toEqual({ id: "1" });
        });
    });

    describe("findWalletByIdAndAccountTx", () => {
        it("should use transaction client", async () => {
            mockTx.wallet.findFirst.mockResolvedValue({ id: "1" });
            const result = await walletRepo.findWalletByIdAndAccountTx(mockTx, "1", "acc-1");
            expect(mockTx.wallet.findFirst).toHaveBeenCalledWith({
                where: { id: "1", accountId: "acc-1" },
                include: { account: true }
            });
            expect(result).toEqual({ id: "1" });
        });
    });

    describe("findWalletsByAccountId", () => {
         it("should call findMany with correct args", async () => {
            mockPrisma.wallet.findMany.mockResolvedValue([{ id: "1" }]);
            const result = await walletRepo.findWalletsByAccountId("acc-1");
            expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith({
                where: { accountId: "acc-1" },
                orderBy: { createdAt: "desc" }
            });
            expect(result).toEqual([{ id: "1" }]);
        });
    });

    describe("updateWalletBalance", () => {
        it("should update with version check", async () => {
            const wallet = { id: "1", version: 5, balance: 100 };
            mockTx.wallet.update.mockResolvedValue({ ...wallet, balance: 200, version: 6 });
            
            const result = await walletRepo.updateWalletBalance(mockTx, wallet, 200);
            
            expect(mockTx.wallet.update).toHaveBeenCalledWith({
                where: { id: "1", version: 5 },
                data: {
                    balance: 200,
                    version: { increment: 1 }
                }
            });
            expect(result.balance).toBe(200);
        });
    });

    describe("creditWallet", () => {
        it("should update balance directly", async () => {
            mockTx.wallet.update.mockResolvedValue({ id: "1", balance: 150 });
            
            const result = await walletRepo.creditWallet(mockTx, "1", 100, 50);
            
            expect(mockTx.wallet.update).toHaveBeenCalledWith({
                where: { id: "1" },
                data: { balance: 150 } // 100 + 50
            });
            expect(result.balance).toBe(150);
        });
    });

    describe("debitWallet", () => {
        it("should debit with version check", async () => {
            const wallet = { id: "1", version: 5, balance: 100 };
            mockTx.wallet.update.mockResolvedValue({ ...wallet, balance: 50, version: 6 });
            
            const result = await walletRepo.debitWallet(mockTx, wallet, 50);
            
            expect(mockTx.wallet.update).toHaveBeenCalledWith({
                where: { id: "1", version: 5 },
                data: {
                    balance: 50, // 100 - 50
                    version: { increment: 1 }
                }
            });
            expect(result.balance).toBe(50);
        });
    });

});
