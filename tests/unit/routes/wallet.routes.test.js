import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRouter = {
  use: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
};

vi.mock("express", () => ({
  default: {
    Router: vi.fn(() => mockRouter),
  },
}));

vi.mock("../../../src/handlers/wallets/index.mjs", () => ({
  getWallet: vi.fn(),
  getBalance: vi.fn(),
  getTransactions: vi.fn(),
  deposit: vi.fn(),
  withdraw: vi.fn(),
}));

vi.mock("../../../src/middleware/auth.mjs", () => ({
  default: vi.fn(),
}));

vi.mock("../../../src/middleware/idempotency.mjs", () => ({
  idempotency: vi.fn(),
}));

describe("Wallet Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should configure wallet routes", async () => {
    await import("../../../src/routes/wallet.routes.mjs");

    // Check middleware usage
    expect(mockRouter.use).toHaveBeenCalledWith(expect.any(Function));

    // Check GET routes
    expect(mockRouter.get).toHaveBeenCalledWith("/:id", expect.any(Function));
    expect(mockRouter.get).toHaveBeenCalledWith("/:id/balance", expect.any(Function));
    expect(mockRouter.get).toHaveBeenCalledWith("/:id/transactions", expect.any(Function));

    // Check POST routes with idempotency
    expect(mockRouter.post).toHaveBeenCalledWith(
        "/:id/deposit", 
        expect.any(Function), // idempotency
        expect.any(Function)  // handler
    );
    expect(mockRouter.post).toHaveBeenCalledWith(
        "/:id/withdraw", 
        expect.any(Function), 
        expect.any(Function)
    );
  });
});
