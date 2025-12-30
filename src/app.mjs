import express from "express";
import serverless from "serverless-http";
import routes from "./routes.mjs";
import logger from "./infra/logger.mjs";
import { collectMetrics } from "./infra/metrics.mjs";
import { requestLogger, errorLogger } from "./middleware/requestLogger.mjs";
import {
  healthHandler,
  livenessHandler,
  readinessHandler,
} from "./middleware/healthCheck.mjs";

const app = express();

// Trust proxy for accurate IP detection behind load balancers
app.set("trust proxy", true);

// Body parsing
app.use(express.json());

// Request logging with correlation IDs and metrics
app.use(requestLogger);

// ============================================================================
// Health & Monitoring Endpoints (no auth required)
// ============================================================================

// Kubernetes liveness probe - is the process alive?
app.get("/health/live", livenessHandler);

// Kubernetes readiness probe - is the service ready for traffic?
app.get("/health/ready", readinessHandler);

// Detailed health check with component status
app.get("/health", healthHandler);

// Prometheus metrics endpoint
app.get("/metrics", (req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(collectMetrics());
});

// ============================================================================
// API Endpoints
// ============================================================================

// API info endpoint
app.get("/api/v1", (req, res) => {
  res.status(200).json({
    status: 200,
    code: "OK",
    data: {
      version: "1.0.0",
      endpoints: [
        "POST /api/v1/transactions/authorize",
        "POST /api/v1/transactions/debit",
        "POST /api/v1/transactions/credit",
        "POST /api/v1/transactions/reverse",
      ],
      monitoring: [
        "GET /health",
        "GET /health/live",
        "GET /health/ready",
        "GET /metrics",
      ],
    },
  });
});

// Mount transaction routes under /api/v1/transactions
app.use("/api/v1/transactions", routes);

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    code: "NOT_FOUND",
    error: `Route ${req.method} ${req.path} not found`,
    correlationId: req.correlationId,
  });
});

// Global error handler with logging
app.use(errorLogger);

// ============================================================================
// Server Startup
// ============================================================================

export const handler = serverless(app);

if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    logger.info({ port }, `Server running on :${port}`);
  });
}
