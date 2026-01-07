import { describe, it, expect, vi, beforeEach } from "vitest";
import * as userRepo from "../../../../src/infra/repositories/user.repo.mjs";

const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            user: {
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

describe("User Repository", () => {
    const mockTx = {
        user: {
            create: vi.fn()
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockTx.user.create.mockReset();
    });

    describe("findById", () => {
        it("should call findUnique with correct include", async () => {
            await userRepo.findById("u-1");
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: "u-1" },
                include: { account: { include: { wallets: true } } }
            });
        });
    });

    describe("findByEmail", () => {
        it("should call findUnique w email", async () => {
             await userRepo.findByEmail("u@e.com");
             expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                 where: { email: "u@e.com" },
                 include: { account: true }
             });
        });
    });

    describe("createUserWithAccountAndWallet", () => {
        it("should create shallow nested structure", async () => {
            mockTx.user.create.mockResolvedValue({});
            
            await userRepo.createUserWithAccountAndWallet(mockTx, { 
                email: "a@b.com", 
                passwordHash: "hash" 
            });

            expect(mockTx.user.create).toHaveBeenCalledWith({
                data: {
                    email: "a@b.com",
                    passwordHash: "hash",
                    role: "CUSTOMER",
                    account: {
                        create: {
                            status: "ACTIVE",
                            wallets: {
                                create: {
                                    balance: 0,
                                    currency: "USD"
                                }
                            }
                        }
                    }
                },
                include: {
                    account: {
                        include: {
                            wallets: true,
                        },
                    },
                },
            });
        });
    });

    describe("findMany", () => {
        it("should query with defaults", async () => {
            await userRepo.findMany();
            expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
                where: {},
                orderBy: { createdAt: "desc" },
                skip: 0,
                take: 20,
                select: expect.anything()
            });
        });

        it("should query with filters", async () => {
            await userRepo.findMany({ page: 2, role: "ADMIN", search: "foo" });
            expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
                where: { role: "ADMIN", email: { contains: "foo" } },
                orderBy: { createdAt: "desc" },
                skip: 20,
                take: 20,
                select: expect.anything()
            });
        });
    });

    describe("count", () => {
        it("should count with defaults", async () => {
            await userRepo.count();
            expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: {} });
        });

        it("should count with filters", async () => {
            await userRepo.count({ role: "ADMIN", search: "foo" });
            expect(mockPrisma.user.count).toHaveBeenCalledWith({
                where: { role: "ADMIN", email: { contains: "foo" } }
            });
        });
    });
});
