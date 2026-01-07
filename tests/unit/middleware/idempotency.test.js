import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        transaction: {
            findFirst: vi.fn(),
        }
    }
}));

vi.mock("../../../src/infra/prisma.mjs", () => ({ prisma: mockPrisma }));

import { idempotency } from "../../../src/middleware/idempotency.mjs";

describe("Idempotency Middleware", () => {
    let req, res, next;

    beforeEach(() => {
        vi.clearAllMocks();
        req = {
            body: { referenceId: "ref-123" },
            user: { account: { id: "acc-1" } }
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
    });

    it("should validation referenceId presence", async () => {
        req.body.referenceId = undefined;
        await idempotency(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it("should allow unused referenceId", async () => {
        mockPrisma.transaction.findFirst.mockResolvedValue(null);
        
        await idempotency(req, res, next);
        
        expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
            where: {
                referenceId: "ref-123",
                wallet: { accountId: "acc-1" }
            }
        });
        expect(next).toHaveBeenCalled();
    });

    it("should reject used referenceId", async () => {
        mockPrisma.transaction.findFirst.mockResolvedValue({ id: "tx-old" });
        
        await idempotency(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining("Duplicate transaction")
        }));
        expect(next).not.toHaveBeenCalled();
    });
});
