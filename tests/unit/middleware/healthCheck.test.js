import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mocks
const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        $queryRaw: vi.fn(),
    }
}));

const { mockRedis } = vi.hoisted(() => ({
    mockRedis: {
        ping: vi.fn(),
    }
}));

const { mockLogger } = vi.hoisted(() => ({
    mockLogger: {
        error: vi.fn(),
    }
}));

// Mock modules
vi.mock("../../../src/infra/prisma.mjs", () => ({ prisma: mockPrisma }));
vi.mock("../../../src/infra/redis.mjs", () => ({ redis: mockRedis }));
vi.mock("../../../src/infra/logger.mjs", () => ({ default: mockLogger }));

import {
  livenessHandler,
  readinessHandler,
  healthHandler,
  HealthStatus
} from "../../../src/middleware/healthCheck.mjs";

describe("Health Check Middleware", () => {
    let req, res;

    beforeEach(() => {
        vi.clearAllMocks();
        req = {};
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
    });

    describe("livenessHandler", () => {
        it("should return 200 OK", () => {
            livenessHandler(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 200,
                code: "OK",
                data: expect.objectContaining({ alive: true })
            }));
        });
    });

    describe("readinessHandler", () => {
        it("should return 200 when all components are healthy", async () => {
            mockPrisma.$queryRaw.mockResolvedValue([1]);
            mockRedis.ping.mockResolvedValue("PONG");

            await readinessHandler(req, res);

            expect(mockPrisma.$queryRaw).toHaveBeenCalled();
            expect(mockRedis.ping).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ 
                    ready: true, 
                    status: HealthStatus.HEALTHY 
                })
            }));
        });

        it("should return 503 when DB fails", async () => {
            mockPrisma.$queryRaw.mockRejectedValue(new Error("DB Down"));
            mockRedis.ping.mockResolvedValue("PONG");

            await readinessHandler(req, res);

            // checkDatabase catches error and returns UNHEALTHY
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ ready: false, status: HealthStatus.UNHEALTHY })
            }));
        });

        it("should return 503 when Redis fails", async () => {
            // This covers checkRedis catch block
            mockPrisma.$queryRaw.mockResolvedValue([1]);
            mockRedis.ping.mockRejectedValue(new Error("Redis Down"));

            await readinessHandler(req, res);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: "Redis Down" }), 
                "Redis health check failed"
            );
            expect(res.status).toHaveBeenCalledWith(503);
        });

        it("should handle unexpected errors in handler (outer catch)", async () => {
            mockPrisma.$queryRaw.mockResolvedValue([1]);
            mockRedis.ping.mockResolvedValue("PONG");
            
            // Force error in response composition check ONLY ONCE
            res.json.mockImplementationOnce(() => { throw new Error("Response fail"); });

            await readinessHandler(req, res);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: "Response fail" }),
                "Readiness check error"
            );
        });
    });

    describe("healthHandler", () => {
        it("should return complete health status", async () => {
             mockPrisma.$queryRaw.mockResolvedValue([1]);
             mockRedis.ping.mockResolvedValue("PONG");

             await healthHandler(req, res);

             expect(res.status).toHaveBeenCalledWith(200);
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                 data: expect.objectContaining({
                     components: expect.anything(),
                     process: expect.anything()
                 })
             }));
        });

        it("should handle unexpected errors (outer catch)", async () => {
             mockPrisma.$queryRaw.mockResolvedValue([1]);
             
             // Simulate error to trigger catch
             res.json.mockImplementationOnce(() => { throw new Error("Wrapper error"); });

             await healthHandler(req, res);

             expect(mockLogger.error).toHaveBeenCalledWith(
                 expect.objectContaining({ error: "Wrapper error" }),
                 "Health check error"
             );
             expect(res.status).toHaveBeenCalledWith(503);
        });
    });
});
