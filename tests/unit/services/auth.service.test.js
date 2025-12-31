import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Auth Service Tests
 *
 * Unit tests for the authentication service logic.
 * Tests password hashing, JWT generation, and validation logic.
 */

describe("Auth Service Logic", () => {
  const JWT_SECRET = "test-jwt-secret";

  describe("password hashing", () => {
    it("should hash a password", async () => {
      const password = "securePassword123";
      const hash = await bcrypt.hash(password, 12);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it("should verify correct password", async () => {
      const password = "securePassword123";
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "securePassword123";
      const wrongPassword = "wrongPassword456";
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it("should generate different hashes for same password", async () => {
      const password = "securePassword123";
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);

      expect(hash1).not.toBe(hash2);
      // Both should still verify correctly
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });

  describe("JWT token generation", () => {
    const generateToken = (user) => {
      return jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
    };

    it("should generate a valid JWT token", () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        role: "CUSTOMER",
      };

      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include user data in token payload", () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        role: "CUSTOMER",
      };

      const token = generateToken(user);
      const payload = jwt.verify(token, JWT_SECRET);

      expect(payload.sub).toBe(user.id);
      expect(payload.email).toBe(user.email);
      expect(payload.role).toBe(user.role);
    });

    it("should set expiration time", () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        role: "CUSTOMER",
      };

      const token = generateToken(user);
      const payload = jwt.verify(token, JWT_SECRET);

      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it("should fail verification with wrong secret", () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        role: "CUSTOMER",
      };

      const token = generateToken(user);

      expect(() => {
        jwt.verify(token, "wrong-secret");
      }).toThrow();
    });
  });

  describe("email validation", () => {
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it("should validate correct email formats", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name@domain.org")).toBe(true);
      expect(isValidEmail("user+tag@sub.domain.com")).toBe(true);
    });

    it("should reject invalid email formats", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("notanemail")).toBe(false);
      expect(isValidEmail("@nodomain.com")).toBe(false);
      expect(isValidEmail("missing@.com")).toBe(false);
      expect(isValidEmail("spaces in@email.com")).toBe(false);
    });
  });

  describe("password validation", () => {
    const isValidPassword = (password) => {
      if (password === undefined || password === null) {
        return false;
      }
      return password.length >= 8 && password.length <= 128;
    };

    it("should accept valid passwords", () => {
      expect(isValidPassword("12345678")).toBe(true);
      expect(isValidPassword("securePassword123!")).toBe(true);
      expect(isValidPassword("a".repeat(128))).toBe(true);
    });

    it("should reject short passwords", () => {
      expect(isValidPassword("")).toBe(false);
      expect(isValidPassword("1234567")).toBe(false);
    });

    it("should reject too long passwords", () => {
      expect(isValidPassword("a".repeat(129))).toBe(false);
    });

    it("should reject undefined/null passwords", () => {
      expect(isValidPassword(undefined)).toBe(false);
      expect(isValidPassword(null)).toBe(false);
    });
  });
});
