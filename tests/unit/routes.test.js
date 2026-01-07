import { describe, it, expect, vi } from "vitest";

// Mock handlers to avoid loading dependencies
vi.mock("../../src/handlers/authorize.mjs", () => ({ default: vi.fn() }));
vi.mock("../../src/handlers/debit.mjs", () => ({ default: vi.fn() }));
vi.mock("../../src/handlers/credit.mjs", () => ({ default: vi.fn() }));
vi.mock("../../src/handlers/reverse.mjs", () => ({ default: vi.fn() }));
vi.mock("../../src/middleware/auth.mjs", () => ({ default: vi.fn((req, res, next) => next()) }));
vi.mock("../../src/middleware/signature.mjs", () => ({ default: vi.fn((req, res, next) => next()) }));
vi.mock("../../src/middleware/idempotency.mjs", () => ({ idempotency: vi.fn((req, res, next) => next()) }));

describe("Transaction Routes", () => {
    it("should export a router", async () => {
        const routes = await import("../../src/routes.mjs");
        expect(routes.default).toBeTruthy();
        // Express router is a function
        expect(typeof routes.default).toBe("function");
    });
});
