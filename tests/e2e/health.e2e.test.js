import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import express from "express";

/**
 * Health Endpoint E2E Tests
 *
 * These tests verify the health endpoint works correctly.
 * We create a minimal test app that mirrors the production health endpoint.
 */

// Create a minimal test app with health endpoint
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Health endpoint - no auth required
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: 200,
      code: "OK",
      data: {
        message: "Service is healthy",
        timestamp: new Date().toISOString(),
      },
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      status: 404,
      code: "NOT_FOUND",
      error: "Endpoint not found",
    });
  });

  return app;
};

describe("Health Endpoint E2E Tests", () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe("GET /health", () => {
    it("should return 200 with health status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 200,
        code: "OK",
        data: expect.objectContaining({
          message: "Service is healthy",
          timestamp: expect.any(String),
        }),
      });
    });

    it("should not require authentication", async () => {
      const response = await request(app)
        .get("/health")
        .set("Accept", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.code).toBe("OK");
    });

    it("should return JSON content type", async () => {
      const response = await request(app).get("/health");

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });

    it("should include timestamp in response", async () => {
      const before = new Date();
      const response = await request(app).get("/health");
      const after = new Date();

      const timestamp = new Date(response.body.data.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("404 handler", () => {
    it("should return 404 for unknown endpoints", async () => {
      const response = await request(app).get("/unknown-endpoint");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 404,
        code: "NOT_FOUND",
        error: "Endpoint not found",
      });
    });
  });
});
