/**
 * @fileoverview Main Express application entry point.
 * 
 * Configures and exports the Express application with:
 * - CORS and security middleware (helmet, rate limiting)
 * - Request logging and metrics collection
 * - Health check endpoints (liveness, readiness, full health)
 * - Authentication and authorization
 * - Transaction and wallet API routes
 * - Admin routes for system management
 * - Error handling and graceful shutdown
 * 
 * The application is designed to be deployed in both serverless (AWS Lambda)
 * and traditional server environments.
 * 
 * @module app
 */

import express from "express";
import serverless from "serverless-http";
import routes from "./routes.mjs";
import authRoutes from "./routes/auth.routes.mjs";
import walletRoutes from "./routes/wallet.routes.mjs";
import adminRoutes from "./routes/admin.routes.mjs";
import logger from "./infra/logger.mjs";
import { collectMetrics } from "./infra/metrics.mjs";
import { requestLogger, errorLogger } from "./middleware/requestLogger.mjs";
import {
  healthHandler,
  livenessHandler,
  readinessHandler,
} from "./middleware/healthCheck.mjs";
import { setupSwagger } from "./docs/swagger.mjs";
import { generalLimiter } from "./middleware/rateLimit.mjs";
import {
  createWebhook,
  getWebhooks,
  deleteWebhook,
} from "./handlers/webhooks.mjs";
import {
  getRates,
  convert,
  getSupportedCurrencies,
} from "./handlers/currency.mjs";
import auth from "./middleware/auth.mjs";


/**
 * Express application instance.
 * @type {express.Application}
 */
export const app = express();

// Trust proxy for accurate IP detection behind load balancers
app.set("trust proxy", true);

// Initialize Swagger Documentation
setupSwagger(app);

// ============================================================================
// CORS Middleware - Must be before body parsing and auth
// ============================================================================
app.use((req, res, next) => {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://localhost:5173",
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-Id, X-Signature, X-Timestamp, X-Nonce"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight requests immediately - don't pass to auth
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

// Body parsing
app.use(express.json());

// General rate limiting for all API endpoints
app.use("/api/", generalLimiter);

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

// Root endpoint - API information
app.get("/", (req, res) => {
  res.status(200).json({
    name: "Wallet API",
    description: "A secure, production-ready wallet transaction API with two-phase debit authorization",
    version: "1.5.0",
    documentation: "/api/v1",
    endpoints: {
      api: "/api/v1",
      health: "/health",
      metrics: "/metrics",
    },
    glossary: {
      authorize: "Reserve/hold funds for later capture (creates PENDING transaction)",
      debit: "Capture/complete a reserved transaction (PENDING → COMPLETED)",
      credit: "Add funds directly to wallet (immediate)",
      reverse: "Release/cancel a reservation or undo a transaction (→ REVERSED)",
      deposit: "Customer-initiated credit to own wallet",
      withdraw: "Customer-initiated debit from own wallet",
      freeze: "Admin action to block all wallet operations",
      unfreeze: "Admin action to restore wallet operations",
    },
    links: {
      auth: {
        register: "POST /api/v1/auth/register - Create new account",
        login: "POST /api/v1/auth/login - Authenticate and get JWT token",
        me: "GET /api/v1/auth/me - Get current user info",
      },
      wallets: {
        get: "GET /api/v1/wallets/:id - Get wallet details",
        balance: "GET /api/v1/wallets/:id/balance - Get current balance",
        transactions: "GET /api/v1/wallets/:id/transactions - Get transaction history",
        deposit: "POST /api/v1/wallets/:id/deposit - Add funds (credit)",
        withdraw: "POST /api/v1/wallets/:id/withdraw - Remove funds (debit)",
      },
      admin: {
        users: "GET /api/v1/admin/users - List all users",
        wallets: "GET /api/v1/admin/wallets - List all wallets",
        transactions: "GET /api/v1/admin/transactions - List all transactions",
        freeze: "POST /api/v1/admin/wallets/:id/freeze - Block wallet operations",
        unfreeze: "POST /api/v1/admin/wallets/:id/unfreeze - Restore wallet operations",
        reverse: "POST /api/v1/admin/transactions/:id/reverse - Undo completed transaction",
      },
      transactions: {
        authorize: "POST /api/v1/transactions/authorize - Reserve funds (hold)",
        debit: "POST /api/v1/transactions/debit - Capture reserved funds",
        credit: "POST /api/v1/transactions/credit - Direct credit",
        reverse: "POST /api/v1/transactions/reverse - Release reservation (undo)",
      },
      monitoring: {
        health: "GET /health - Full health check",
        liveness: "GET /health/live - Kubernetes liveness probe",
        readiness: "GET /health/ready - Kubernetes readiness probe",
        metrics: "GET /metrics - Prometheus metrics",
      },
    },
  });
});

// API info endpoint
app.get("/api/v1", (req, res) => {
  res.status(200).json({
    status: 200,
    code: "OK",
    data: {
      version: "1.3.3",
      endpoints: {
        auth: [
          "POST /api/v1/auth/register",
          "POST /api/v1/auth/login",
          "GET /api/v1/auth/me",
        ],
        wallets: [
          "GET /api/v1/wallets/:id",
          "GET /api/v1/wallets/:id/balance",
          "GET /api/v1/wallets/:id/transactions",
          "POST /api/v1/wallets/:id/deposit",
          "POST /api/v1/wallets/:id/withdraw",
        ],
        admin: [
          "GET /api/v1/admin/users",
          "GET /api/v1/admin/wallets",
          "GET /api/v1/admin/transactions",
          "POST /api/v1/admin/wallets/:id/freeze",
          "POST /api/v1/admin/wallets/:id/unfreeze",
          "POST /api/v1/admin/transactions/:id/reverse",
        ],
        transactions: [
          "POST /api/v1/transactions/authorize",
          "POST /api/v1/transactions/debit",
          "POST /api/v1/transactions/credit",
          "POST /api/v1/transactions/reverse",
        ],
      },
      monitoring: [
        "GET /health",
        "GET /health/live",
        "GET /health/ready",
        "GET /metrics",
      ],
    },
  });
});

// Mount auth routes under /api/v1/auth
app.use("/api/v1/auth", authRoutes);

// Mount wallet routes under /api/v1/wallets
app.use("/api/v1/wallets", walletRoutes);

// Mount admin routes under /api/v1/admin
app.use("/api/v1/admin", adminRoutes);

// Mount transaction routes under /api/v1/transactions
app.use("/api/v1/transactions", routes);

// Mount webhook routes under /api/v1/webhooks
app.post("/api/v1/webhooks", auth, createWebhook);
app.get("/api/v1/webhooks", auth, getWebhooks);
app.delete("/api/v1/webhooks/:id", auth, deleteWebhook);

// Mount currency routes under /api/v1/currency
app.get("/api/v1/currency/rates", getRates);
app.post("/api/v1/currency/convert", convert);
app.get("/api/v1/currency/supported", getSupportedCurrencies);

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

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    logger.info({ port }, `Server running on :${port}`);
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal) => {
    logger.info({ signal }, 'Received shutdown signal, closing server gracefully...');
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // Close database connections
        const { closeDatabaseConnections } = await import('./infra/prisma.mjs');
        await closeDatabaseConnections();
        logger.info('Database connections closed');
        
        // Close Redis connections if any
        try {
          const { closeRedisConnections } = await import('./infra/redis.mjs');
          await closeRedisConnections();
          logger.info('Redis connections closed');
        } catch (err) {
          // Redis module might not export closeRedisConnections yet
          logger.warn('Redis cleanup not available');
        }
        
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
