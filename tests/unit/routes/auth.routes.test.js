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

vi.mock("../../../src/middleware/rateLimit.mjs", () => ({
  authLimiter: vi.fn(),
}));

describe("Auth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should configure auth routes", async () => {
    await import("../../../src/routes/auth.routes.mjs");

    // Check public routes with rate limiting
    // router.post("/register", authLimiter, register);
    expect(mockRouter.post).toHaveBeenCalledWith(
      "/register",
      expect.any(Function), // authLimiter
      expect.any(Function)  // register handler
    );
    expect(mockRouter.post).toHaveBeenCalledWith(
      "/login",
      expect.any(Function), // authLimiter
      expect.any(Function)  // login handler
    );
    
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
