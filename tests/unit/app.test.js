import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

/* ------------------------------------------------------------------
 * Mock infrastructure & route modules
 * ------------------------------------------------------------------ */

// Prevent real logging during tests
vi.mock("../../src/infra/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics collector
vi.mock("../../src/infra/metrics.mjs", () => ({
  collectMetrics: vi.fn(() => "wallet_test_metric 1"),
}));

// Mock request / error logger middleware
vi.mock("../../src/middleware/requestLogger.mjs", () => ({
  requestLogger: (req, _res, next) => {
    req.correlationId = "test-correlation-id";
    next();
  },
  errorLogger: (err, _req, res, _next) => {
    res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  },
}));

// Mock health handlers
vi.mock("../../src/middleware/healthCheck.mjs", () => ({
  livenessHandler: (_req, res) => res.status(200).json({ status: "live" }),
  readinessHandler: (_req, res) => res.status(200).json({ status: "ready" }),
  healthHandler: (_req, res) =>
    res.status(200).json({ status: "ok", components: {} }),
}));

// Mock all route mounts to avoid DB / auth logic
vi.mock("../../src/routes.mjs", () => ({
  default: (_req, res) => res.status(200).json({ route: "transactions" }),
}));

vi.mock("../../src/routes/auth.routes.mjs", () => ({
  default: (_req, res) => res.status(200).json({ route: "auth" }),
}));

vi.mock("../../src/routes/wallet.routes.mjs", () => ({
  default: (_req, res) => res.status(200).json({ route: "wallets" }),
}));

vi.mock("../../src/routes/admin.routes.mjs", () => ({
  default: (_req, res) => res.status(200).json({ route: "admin" }),
}));

/* ------------------------------------------------------------------
 * Import app AFTER mocks
 * ------------------------------------------------------------------ */

let server;

beforeAll(async () => {
  process.env.NODE_ENV = "test";

  const mod = await import("../../src/app.mjs");

  // serverless-http exposes handler, but express app still listens
  server = mod.app;
});

afterAll(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------ */

describe("Wallet API bootstrap", () => {
  it("GET / should return API metadata", async () => {
    const res = await request(server).get("/");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Wallet API");
    expect(res.body.version).toBe("1.3.3");
    expect(res.body.endpoints.api).toBe("/api/v1");
  });

  it("GET /api/v1 should return endpoint listing", async () => {
    const res = await request(server).get("/api/v1");

    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe("1.3.3");
    expect(res.body.data.endpoints).toHaveProperty("auth");
  });

  it("GET /health/live should return liveness", async () => {
    const res = await request(server).get("/health/live");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("live");
  });

  it("GET /health/ready should return readiness", async () => {
    const res = await request(server).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });

  it("GET /health should return detailed health", async () => {
    const res = await request(server).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /metrics should return Prometheus metrics", async () => {
    const res = await request(server).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.text).toContain("wallet_test_metric");
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  it("OPTIONS request should return 204 (CORS preflight)", async () => {
    const res = await request(server)
      .options("/any-route")
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(204);
  });

  it("Unknown route should return structured 404", async () => {
    const res = await request(server).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.error).toContain("Route GET /does-not-exist not found");
    expect(res.body.correlationId).toBe("test-correlation-id");
  });
});
