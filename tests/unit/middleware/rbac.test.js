import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRoles, requireAdmin, requireCustomer, requireAuthenticated } from "../../../src/middleware/rbac.mjs";

describe("RBAC Middleware", () => {
    let req, res, next;

    beforeEach(() => {
        req = { user: { role: "CUSTOMER" } };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
    });

    describe("requireRoles generic", () => {
        it("should return 401 if not authenticated", () => {
            req.user = undefined;
            const middleware = requireRoles("ADMIN");
            middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it("should return 403 if role mismatch", () => {
            const middleware = requireRoles("ADMIN");
            middleware(req, res, next); // user is CUSTOMER
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it("should call next if role matches", () => {
            req.user.role = "ADMIN";
            const middleware = requireRoles("ADMIN");
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe("requireAdmin", () => {
        it("should allow ADMIN", () => {
            req.user.role = "ADMIN";
            requireAdmin(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it("should deny CUSTOMER", () => {
             requireAdmin(req, res, next);
             expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe("requireCustomer", () => {
         it("should allow CUSTOMER", () => {
            requireCustomer(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it("should deny ADMIN", () => {
             req.user.role = "ADMIN";
             requireCustomer(req, res, next);
             expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe("requireAuthenticated", () => {
        it("should allow ADMIN", () => {
             req.user.role = "ADMIN";
             requireAuthenticated(req, res, next);
             expect(next).toHaveBeenCalled();
        });

        it("should allow CUSTOMER", () => {
             requireAuthenticated(req, res, next);
             expect(next).toHaveBeenCalled();
        });

        it("should deny UNKNOWN", () => {
             req.user.role = "UNKNOWN";
             requireAuthenticated(req, res, next);
             expect(res.status).toHaveBeenCalledWith(403);
        });
    });
});
