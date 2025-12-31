import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * RBAC Middleware Tests
 *
 * Unit tests for role-based access control logic.
 */

describe("RBAC Middleware Logic", () => {
  // Simulate the requireRoles middleware logic
  const checkRoles = (userRole, allowedRoles) => {
    if (!userRole) {
      return { allowed: false, code: "UNAUTHORIZED", status: 401 };
    }
    if (!allowedRoles.includes(userRole)) {
      return { allowed: false, code: "FORBIDDEN", status: 403 };
    }
    return { allowed: true };
  };

  describe("requireRoles", () => {
    it("should allow access for matching role", () => {
      const result = checkRoles("ADMIN", ["ADMIN"]);
      expect(result.allowed).toBe(true);
    });

    it("should allow access when user has one of multiple allowed roles", () => {
      const result = checkRoles("CUSTOMER", ["ADMIN", "CUSTOMER"]);
      expect(result.allowed).toBe(true);
    });

    it("should deny access for non-matching role", () => {
      const result = checkRoles("CUSTOMER", ["ADMIN"]);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("FORBIDDEN");
      expect(result.status).toBe(403);
    });

    it("should return unauthorized for missing user", () => {
      const result = checkRoles(undefined, ["ADMIN"]);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.status).toBe(401);
    });

    it("should return unauthorized for null role", () => {
      const result = checkRoles(null, ["ADMIN"]);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.status).toBe(401);
    });
  });

  describe("requireAdmin", () => {
    const checkAdmin = (userRole) => checkRoles(userRole, ["ADMIN"]);

    it("should allow ADMIN role", () => {
      const result = checkAdmin("ADMIN");
      expect(result.allowed).toBe(true);
    });

    it("should deny CUSTOMER role", () => {
      const result = checkAdmin("CUSTOMER");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("FORBIDDEN");
    });
  });

  describe("requireCustomer", () => {
    const checkCustomer = (userRole) => checkRoles(userRole, ["CUSTOMER"]);

    it("should allow CUSTOMER role", () => {
      const result = checkCustomer("CUSTOMER");
      expect(result.allowed).toBe(true);
    });

    it("should deny ADMIN role", () => {
      const result = checkCustomer("ADMIN");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("FORBIDDEN");
    });
  });

  describe("requireAuthenticated", () => {
    const checkAuthenticated = (userRole) =>
      checkRoles(userRole, ["ADMIN", "CUSTOMER"]);

    it("should allow ADMIN role", () => {
      const result = checkAuthenticated("ADMIN");
      expect(result.allowed).toBe(true);
    });

    it("should allow CUSTOMER role", () => {
      const result = checkAuthenticated("CUSTOMER");
      expect(result.allowed).toBe(true);
    });

    it("should deny unknown role", () => {
      const result = checkAuthenticated("UNKNOWN");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("FORBIDDEN");
    });
  });

  describe("role case sensitivity", () => {
    it("should be case sensitive for roles", () => {
      const result = checkRoles("admin", ["ADMIN"]);
      expect(result.allowed).toBe(false);
    });

    it("should match exact role strings", () => {
      const result = checkRoles("ADMIN ", ["ADMIN"]);
      expect(result.allowed).toBe(false);
    });
  });
});
