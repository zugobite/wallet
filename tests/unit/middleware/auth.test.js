import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("../../../src/infra/prisma.mjs", () => ({
  prisma: mockPrisma,
}));

import auth from "../../../src/middleware/auth.mjs";

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  const runAuth = async () => {
    await auth(req, res, next);
  };

  it("should return 401 if header is missing", async () => {
    await runAuth();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Missing or invalid Authorization header" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if header is invalid format", async () => {
    req.headers.authorization = "Basic token";
    await runAuth();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Missing or invalid Authorization header" })
    );
  });

  it("should return 401 if token is invalid", async () => {
    req.headers.authorization = "Bearer invalid-token";
    vi.spyOn(jwt, "verify").mockImplementation(() => {
      throw new Error("Invalid token");
    });
    
    await runAuth();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid or expired token" })
    );
  });

  it("should return 401 if user not found", async () => {
    req.headers.authorization = "Bearer valid-token";
    vi.spyOn(jwt, "verify").mockReturnValue({ sub: "user-123" });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await runAuth();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      include: { account: true },
    });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "User not found" })
    );
  });

  it("should return 403 if account is frozen", async () => {
    req.headers.authorization = "Bearer valid-token";
    vi.spyOn(jwt, "verify").mockReturnValue({ sub: "user-123" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      account: { status: "FROZEN" },
    });

    await runAuth();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Account is frozen" })
    );
  });

  it("should call next() and set req.user if valid", async () => {
    req.headers.authorization = "Bearer valid-token";
    const user = {
      id: "user-123",
      email: "test@example.com",
      role: "USER",
      account: { status: "ACTIVE" },
    };
    vi.spyOn(jwt, "verify").mockReturnValue({ sub: "user-123" });
    mockPrisma.user.findUnique.mockResolvedValue(user);

    await runAuth();
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: user.id,
      email: user.email,
      role: user.role,
      account: user.account,
    });
  });

  it("should handle prisma errors as 401 (catch block matches current impl)", async () => {
    // Note: Current implementation catches ALL errors (including DB errors) and returns 401
    // Ideally this might be a 500, but we test the current behavior
    req.headers.authorization = "Bearer valid-token";
    vi.spyOn(jwt, "verify").mockReturnValue({ sub: "user-123" });
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB Error"));

    await runAuth();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid or expired token" })
    );
  });
});
