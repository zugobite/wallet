import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { canonicalJson } from "../../../src/utils/canonicalJson.mjs";

const { mockRedis } = vi.hoisted(() => ({
    mockRedis: {
        get: vi.fn(),
        set: vi.fn(),
    }
}));

vi.mock("../../../src/infra/redis.mjs", () => ({ redis: mockRedis }));

import signatureMiddleware from "../../../src/middleware/signature.mjs";

describe("Signature Middleware", () => {
    let req, res, next;
    const SECRET = "test-secret";
    
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.REQUEST_SIGNING_SECRET = SECRET;
        process.env.SIGNATURE_TTL_MS = "300000"; // 5 min
        
        req = {
            method: "POST",
            originalUrl: "/api/test",
            headers: {
                "x-signature-version": "v1",
                "x-timestamp": Date.now().toString(),
                "x-nonce": "nonce-1"
            },
            body: { key: "value", a: "1" }
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
    });

    const generateSignature = (req, secret) => {
        const payload = [
            req.method.toUpperCase(),
            req.originalUrl,
            req.headers["x-timestamp"],
            req.headers["x-nonce"],
            canonicalJson(req.body)
        ].join("|");
        
        return crypto
            .createHmac("sha256", secret)
            .update(payload)
            .digest("hex");
    };

    it("should reject missing headers", async () => {
        req.headers = {};
        await signatureMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Missing signature headers" });
    });

    it("should reject unsupported version", async () => {
        req.headers["x-signature-version"] = "v2";
        // Signature presence required to pass the first check
        req.headers["x-signature"] = "dummy";
        
        await signatureMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Unsupported signature version" });
    });

    it("should reject expired request", async () => {
        req.headers["x-signature"] = "dummy";
        req.headers["x-timestamp"] = (Date.now() - 301000).toString(); // > 5 min
        
        await signatureMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Request expired" });
    });

    it("should reject replay detected", async () => {
        req.headers["x-signature"] = "dummy";
        mockRedis.get.mockResolvedValue("1"); // Already seen
        
        await signatureMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Replay detected" });
    });

    it("should reject invalid signature", async () => {
        mockRedis.get.mockResolvedValue(null);
        req.headers["x-signature"] = "invalid_hex_string_1234567890abcdef";
        
        await signatureMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid signature" });
    });

    it("should accept valid signature", async () => {
        mockRedis.get.mockResolvedValue(null);
        const sig = generateSignature(req, SECRET);
        req.headers["x-signature"] = sig;
        
        await signatureMiddleware(req, res, next);
        
        expect(mockRedis.set).toHaveBeenCalledWith(
            expect.stringContaining(req.headers["x-nonce"]),
            "1",
            "PX",
            300000
        );
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it("should sort keys in canonical json correctly", async () => {
        // Body with unsorted keys
        req.body = { z: 1, a: 2 };
        const sig = generateSignature(req, SECRET); 
        // generateSignature uses canonicalJson which sorts keys
        req.headers["x-signature"] = sig;
        
        mockRedis.get.mockResolvedValue(null);
        await signatureMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalled();
    });
});
