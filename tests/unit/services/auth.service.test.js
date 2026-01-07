import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    },
  };
});

// Mock prisma.user.create explicitly since it needs to be available on the transaction client
mockPrisma.user.create = vi.fn();
mockPrisma.account = { create: vi.fn() }; // not directly used but good hygiene
// The transaction client IS (or acts like) prisma itself in our mock
// So tx.user.create should call mockPrisma.user.create

vi.mock("../../../src/infra/prisma.mjs", () => ({
  prisma: mockPrisma,
}));

import * as authService from "../../../src/services/auth.service.mjs";

describe("Auth Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  describe("hashPassword", () => {
    it("should hash password", async () => {
      const hash = await authService.hashPassword("password123");
      expect(hash).toBeDefined();
      expect(hash).not.toBe("password123");
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      const hash = await bcrypt.hash("password123", 10);
      const isValid = await authService.verifyPassword("password123", hash);
      expect(isValid).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      const hash = await bcrypt.hash("password123", 10);
      const isValid = await authService.verifyPassword("wrong", hash);
      expect(isValid).toBe(false);
    });
  });

  describe("generateToken", () => {
    it("should generate valid JWT", () => {
      const user = { id: "u-1", email: "test@example.com", role: "USER" };
      const token = authService.generateToken(user);
      const decoded = jwt.verify(token, "test-secret");
      expect(decoded.sub).toBe("u-1");
      expect(decoded.email).toBe("test@example.com");
    });
  });

  describe("registerUser", () => {
    it("should register new user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: "new-user" });

      const result = await authService.registerUser({
        email: "new@example.com",
        password: "pw",
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "new@example.com" },
      });
      expect(mockPrisma.user.create).toHaveBeenCalled(); // tx.user.create
      expect(result).toEqual({ id: "new-user" });
    });

    it("should fail if email exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        authService.registerUser({ email: "exist@example.com", password: "pw" })
      ).rejects.toThrow("Email already registered");
    });
  });

  describe("authenticateUser", () => {
    it("should return user if credentials are valid", async () => {
      const hash = await bcrypt.hash("pw", 10);
      const user = { id: "u-1", passwordHash: hash, account: { status: "ACTIVE" } };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await authService.authenticateUser({
        email: "test@example.com",
        password: "pw",
      });
      expect(result).toBe(user);
    });

    it("should fail if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        authService.authenticateUser({ email: "none@example.com", password: "pw" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("should fail if password invalid", async () => {
      const hash = await bcrypt.hash("pw", 10);
      const user = { id: "u-1", passwordHash: hash };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        authService.authenticateUser({ email: "test@example.com", password: "wrong" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("should fail if account frozen", async () => {
      const hash = await bcrypt.hash("pw", 10);
      const user = { 
        id: "u-1", 
        passwordHash: hash, 
        account: { status: "FROZEN" } 
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        authService.authenticateUser({ email: "test@example.com", password: "pw" })
      ).rejects.toThrow("Account is frozen");
    });
  });

  describe("getUserById", () => {
    it("should return user", async () => {
      const user = { id: "u-1" };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      const result = await authService.getUserById("u-1");
      expect(result).toBe(user);
    });
  });
});
