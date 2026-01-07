import { describe, it, expect, vi, beforeEach } from "vitest";
import * as txRepo from "../../../../src/infra/repositories/transactions.repo.mjs";

const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            transaction: {
                findUnique: vi.fn(),
                findMany: vi.fn(),
                count: vi.fn(),
            }
        }
    };
});

vi.mock("../../../../src/infra/prisma.mjs", () => ({
    prisma: mockPrisma
}));

describe("Transaction Repository", () => {
    const mockTx = {
        transaction: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn()
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockTx.transaction.findUnique.mockReset();
        mockTx.transaction.create.mockReset();
        mockTx.transaction.update.mockReset();
    });

    describe("findByReference", () => {
        it("should call findUnique with correct args", async () => {
            mockPrisma.transaction.findUnique.mockResolvedValue({ id: "1" });
            const result = await txRepo.findByReference("ref-1");
            expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith({
                where: { referenceId: "ref-1" }
            });
            expect(result).toEqual({ id: "1" });
        });
    });

    describe("findByReferenceTx", () => {
        it("should call findUnique on tx client", async () => {
            mockTx.transaction.findUnique.mockResolvedValue({ id: "1" });
            const result = await txRepo.findByReferenceTx(mockTx, "ref-1");
            expect(mockTx.transaction.findUnique).toHaveBeenCalledWith({
                where: { referenceId: "ref-1" }
            });
            expect(result).toEqual({ id: "1" });
        });
    });

    describe("findById", () => {
        it("should call findUnique with include", async () => {
            mockPrisma.transaction.findUnique.mockResolvedValue({ id: "1" });
            const result = await txRepo.findById("tx-1");
            expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith({
                where: { id: "tx-1" },
                include: { wallet: true }
            });
            expect(result).toEqual({ id: "1" });
        });
    });

    describe("findByIdTx", () => {
        it("should call findUnique on tx with include", async () => {
            mockTx.transaction.findUnique.mockResolvedValue({ id: "1" });
            const result = await txRepo.findByIdTx(mockTx, "tx-1");
            expect(mockTx.transaction.findUnique).toHaveBeenCalledWith({
                where: { id: "tx-1" },
                include: { wallet: true }
            });
            expect(result).toEqual({ id: "1" });
        });
    });

    describe("createTransaction", () => {
        it("should call create", async () => {
            const data = { id: "tx-1", amount: 100 };
            mockTx.transaction.create.mockResolvedValue(data);
            const result = await txRepo.createTransaction(mockTx, data);
            expect(mockTx.transaction.create).toHaveBeenCalledWith({ data });
            expect(result).toEqual(data);
        });
    });

    describe("updateTransactionStatus", () => {
        it("should call update", async () => {
            mockTx.transaction.update.mockResolvedValue({ id: "tx-1", status: "completed" });
            const result = await txRepo.updateTransactionStatus(mockTx, "tx-1", "completed");
            expect(mockTx.transaction.update).toHaveBeenCalledWith({
                where: { id: "tx-1" },
                data: { status: "completed" }
            });
            expect(result.status).toBe("completed");
        });
    });

    describe("findByWalletId", () => {
        it("should query with defaults", async () => {
            await txRepo.findByWalletId("w-1");
            expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
                where: { walletId: "w-1" },
                orderBy: { createdAt: "desc" },
                skip: 0,
                take: 20,
                include: { ledger: true }
            });
        });

        it("should query with filters and pagination", async () => {
             await txRepo.findByWalletId("w-1", { page: 2, limit: 10, type: "debit", status: "completed" });
             expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
                where: { walletId: "w-1", type: "debit", status: "completed" },
                orderBy: { createdAt: "desc" },
                skip: 10,
                take: 10,
                include: { ledger: true }
            });
        });
        
        it("should query with partial filters", async () => {
             await txRepo.findByWalletId("w-1", { type: "credit" });
             expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
                where: { walletId: "w-1", type: "credit" },
                orderBy: { createdAt: "desc" },
                skip: 0,
                take: 20,
                include: { ledger: true }
            });
        });
    });

    describe("countByWalletId", () => {
        it("should count with defaults", async () => {
            await txRepo.countByWalletId("w-1");
            expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
                where: { walletId: "w-1" }
            });
        });

        it("should count with filters", async () => {
            await txRepo.countByWalletId("w-1", { type: "debit", status: "completed" });
            expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
                where: { walletId: "w-1", type: "debit", status: "completed" }
            });
        });
    });
});
