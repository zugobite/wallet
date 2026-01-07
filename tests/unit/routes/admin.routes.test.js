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

vi.mock("../../../src/handlers/admin/index.mjs", () => ({
  listUsers: vi.fn(),
  listWallets: vi.fn(),
  listTransactions: vi.fn(),
  freezeWallet: vi.fn(),
  unfreezeWallet: vi.fn(),
  reverseTransaction: vi.fn(),
}));

vi.mock("../../../src/middleware/auth.mjs", () => ({
  default: vi.fn(),
}));

vi.mock("../../../src/middleware/rbac.mjs", () => ({
  requireAdmin: vi.fn(),
}));

describe("Admin Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should configure admin routes", async () => {
    await import("../../../src/routes/admin.routes.mjs");

    // Check middleware
    expect(mockRouter.use).toHaveBeenCalledTimes(2);
    // checks call order or generally usage

    // Check oversight endpoints
    expect(mockRouter.get).toHaveBeenCalledWith("/users", expect.any(Function));
    expect(mockRouter.get).toHaveBeenCalledWith("/wallets", expect.any(Function));
    expect(mockRouter.get).toHaveBeenCalledWith("/transactions", expect.any(Function));

    // Check control endpoints
    expect(mockRouter.post).toHaveBeenCalledWith("/wallets/:id/freeze", expect.any(Function));
    expect(mockRouter.post).toHaveBeenCalledWith("/wallets/:id/unfreeze", expect.any(Function));
    expect(mockRouter.post).toHaveBeenCalledWith("/transactions/:id/reverse", expect.any(Function));
  });
});
