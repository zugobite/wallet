import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mocks
const { mockLogger, mockMetrics, mockAlerting } = vi.hoisted(() => {
    const loggerInstance = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };

    return {
        mockLogger: {
            default: loggerInstance,
            generateCorrelationId: vi.fn(() => "test-correlation-id"),
            createRequestLogger: vi.fn(() => loggerInstance),
            auditLog: vi.fn(),
        },
        mockMetrics: {
            httpRequestsTotal: { inc: vi.fn() },
            httpRequestDuration: { observe: vi.fn() },
            activeRequests: { inc: vi.fn(), dec: vi.fn() },
            errorsTotal: { inc: vi.fn() },
        },
        mockAlerting: {
            alertHighLatency: vi.fn(),
        }
    };
});

vi.mock("../../../src/infra/logger.mjs", () => ({
    default: mockLogger.default,
    generateCorrelationId: mockLogger.generateCorrelationId,
    createRequestLogger: mockLogger.createRequestLogger,
    auditLog: mockLogger.auditLog,
}));

vi.mock("../../../src/infra/metrics.mjs", () => mockMetrics);
vi.mock("../../../src/infra/alerting.mjs", () => mockAlerting);

import { requestLogger, errorLogger } from "../../../src/middleware/requestLogger.mjs";

describe("Request Logger Middleware", () => {
    let req, res, next, finishCallback, errorCallback;

    beforeEach(() => {
        vi.clearAllMocks();
        
        req = {
            method: "GET",
            path: "/api/users/123",
            headers: {},
            get: vi.fn((key) => {
                const headers = { "user-agent": "jest-test" };
                return headers[key.toLowerCase()];
            }),
            ip: "127.0.0.1",
            query: {}
        };

        res = {
            statusCode: 200,
            setHeader: vi.fn(),
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            get: vi.fn(), 
            on: vi.fn((event, cb) => {
                if (event === "finish") finishCallback = cb;
                if (event === "error") errorCallback = cb;
            })
        };

        next = vi.fn();
    });

    describe("requestLogger", () => {
        it("should generate correlation ID and set header", () => {
            requestLogger(req, res, next);
            expect(req.correlationId).toBe("test-correlation-id");
            expect(res.setHeader).toHaveBeenCalledWith("X-Correlation-ID", "test-correlation-id");
            expect(next).toHaveBeenCalled();
        });

        it("should normalize paths in metrics", async () => {
            req.path = "/api/users/123/transactions/550e8400-e29b-41d4-a716-446655440000";
            requestLogger(req, res, next);
            
            await finishCallback();

            expect(mockMetrics.httpRequestsTotal.inc).toHaveBeenCalledWith(
                expect.objectContaining({ path: "/api/users/:id/transactions/:id" })
            );
        });

        it("should log response errors", () => {
            requestLogger(req, res, next);
            const error = new Error("Network error");
            errorCallback(error);

            expect(mockLogger.default.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: "Network error" }),
                "Request error"
            );
            expect(mockMetrics.errorsTotal.inc).toHaveBeenCalledWith(
                expect.objectContaining({ type: "request_error" })
            );
        });

        it("should alert on high latency", async () => {
            vi.useFakeTimers();
            // Mock process.hrtime.bigint
            const originalHrtime = process.hrtime.bigint;
            
            // First call returns 1000n, second returns 6000000000n (6 seconds later in ns)
            // 6 seconds * 1e9 = 6,000,000,000 ns
            let callCount = 0;
            process.hrtime.bigint = vi.fn(() => {
                if (callCount === 0) {
                    callCount++;
                    return 1000n;
                }
                return 6000001000n;
            });

            try {
                requestLogger(req, res, next);
                await finishCallback();

                expect(mockAlerting.alertHighLatency).toHaveBeenCalled();
            } finally {
                process.hrtime.bigint = originalHrtime;
                vi.useRealTimers();
            }
        });
    });

    describe("errorLogger", () => {
        let err;

        beforeEach(() => {
            err = new Error("Something went wrong");
            err.statusCode = 400;
        });

        it("should log error and increment metrics", () => {
            errorLogger(err, req, res, next);
            
            expect(mockLogger.default.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: "Something went wrong", statusCode: 400 }),
                "Unhandled error"
            );
            expect(mockMetrics.errorsTotal.inc).toHaveBeenCalledWith({
                type: "unhandled_error",
                code: 400
            });
        });

        it("should respond with error details in development", () => {
            process.env.NODE_ENV = "development";
            errorLogger(err, req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: "Something went wrong"
            }));
        });

        it("should mask error details in production", () => {
            process.env.NODE_ENV = "production";
            err.statusCode = 500;
            errorLogger(err, req, res, next);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: "An internal error occurred"
            }));
        });
    });
});
