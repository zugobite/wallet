import { describe, it, expect, vi, beforeEach } from "vitest";
import * as accountRepo from "../../../../src/infra/repositories/account.repo.mjs";

const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            account: {
                findUnique: vi.fn(),
                update: vi.fn(),
            }
        }
    };
});

vi.mock("../../../../src/infra/prisma.mjs", () => ({
    prisma: mockPrisma
}));

describe("Account Repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("findById", () => {
        it("should find unique", async () => {
            mockPrisma.account.findUnique.mockResolvedValue({ id: "1" });
            await accountRepo.findById("1");
            expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
                where: { id: "1" },
                include: { user: true, wallets: true }
            });
        });
    });

    describe("findByUserId", () => {
         it("should find by user id", async () => {
            mockPrisma.account.findUnique.mockResolvedValue({ id: "1" });
            await accountRepo.findByUserId("u-1");
            expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
                where: { userId: "u-1" },
                include: { wallets: true }
            });
        });
    });

    describe("updateStatus", () => {
        it("should update status", async () => {
             mockPrisma.account.update.mockResolvedValue({ id: "1", status: "FROZEN" });
             await accountRepo.updateStatus("1", "FROZEN");
             expect(mockPrisma.account.update).toHaveBeenCalledWith({
                 where: { id: "1" },
                 data: { status: "FROZEN" }
             });
        });
    });

    describe("freeze", () => {
        it("should call updateStatus with FROZEN", async () => {
             mockPrisma.account.update.mockResolvedValue({ id: "1", status: "FROZEN" });
             await accountRepo.freeze("1");
             expect(mockPrisma.account.update).toHaveBeenCalledWith({
                 where: { id: "1" },
                 data: { status: "FROZEN" }
             });
        });
    });

    describe("unfreeze", () => {
        it("should call updateStatus with ACTIVE", async () => {
             mockPrisma.account.update.mockResolvedValue({ id: "1", status: "ACTIVE" });
             await accountRepo.unfreeze("1");
             expect(mockPrisma.account.update).toHaveBeenCalledWith({
                 where: { id: "1" },
                 data: { status: "ACTIVE" }
             });
        });
    });
});
