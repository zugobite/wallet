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

vi.mock("../../../src/handlers/auth/index.mjs", () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}));

vi.mock("../../../src/middleware/auth.mjs", () => ({
  default: vi.fn(),
}));

describe("Auth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should configure auth routes", async () => {
    await import("../../../src/routes/auth.routes.mjs");

    expect(mockRouter.post).toHaveBeenCalledWith("/register", expect.any(Function));
    expect(mockRouter.post).toHaveBeenCalledWith("/login", expect.any(Function));
    
    // Check protected route
    // It uses auth middleware: router.get("/me", auth, me);
    // So arguments should be path, middleware, handler
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/me", 
      expect.any(Function), // auth middleware
      expect.any(Function)  // me handler
    );
  });
});
