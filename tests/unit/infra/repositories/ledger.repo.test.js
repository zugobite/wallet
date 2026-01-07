import { describe, it, expect, vi, beforeEach } from "vitest";
import * as ledgerRepo from "../../../../src/infra/repositories/ledger.repo.mjs";

describe("Ledger Repository", () => {
    const mockTx = {
        ledgerEntry: {
            create: vi.fn(),
            findMany: vi.fn(),
        }
    };

    beforeEach(() => {
        mockTx.ledgerEntry.create.mockReset();
        mockTx.ledgerEntry.findMany.mockReset();
    });

    describe("createLedgerEntry", () => {
        it("should create entry", async () => {
            const data = { id: "1" };
            mockTx.ledgerEntry.create.mockResolvedValue(data);
            const result = await ledgerRepo.createLedgerEntry(mockTx, data);
            expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith({ data });
            expect(result).toBe(data);
        });
    });

    describe("findByTransactionId", () => {
        it("should find entries", async () => {
            mockTx.ledgerEntry.findMany.mockResolvedValue([]);
            await ledgerRepo.findByTransactionId(mockTx, "tx-1");
            expect(mockTx.ledgerEntry.findMany).toHaveBeenCalledWith({
                where: { transactionId: "tx-1" },
                orderBy: { createdAt: "asc" }
            });
        });
    });
});
