import logger, {
  generateCorrelationId,
  createRequestLogger,
  auditLog,
} from "../infra/logger.mjs";
import {
  httpRequestsTotal,
  httpRequestDuration,
  activeRequests,
  errorsTotal,
} from "../infra/metrics.mjs";
import { alertHighLatency } from "../infra/alerting.mjs";

/**
 * Request logging middleware with correlation IDs and metrics
 */
export const requestLogger = (req, res, next) => {
  // Generate or extract correlation ID
  const correlationId =
    req.headers["x-correlation-id"] ||
    req.headers["x-request-id"] ||
    generateCorrelationId();

  // Attach to request and response
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);

  // Create child logger for this request
  req.log = createRequestLogger(correlationId, {
    method: req.method,
    path: req.path,
    userAgent: req.get("user-agent"),
    ip: req.ip || req.connection?.remoteAddress,
  });

  // Track active requests
  activeRequests.inc();

  // Start timer for request duration
  const startTime = process.hrtime.bigint();

  // Log request start
  req.log.info(
    {
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      contentLength: req.get("content-length"),
    },
    "Request started"
  );

  // Capture response on finish
  res.on("finish", async () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    // Decrement active requests
    activeRequests.dec();

    // Normalize path for metrics (remove IDs to prevent cardinality explosion)
    const normalizedPath = normalizePath(req.path);

    // Record metrics
    httpRequestsTotal.inc({
      method: req.method,
      path: normalizedPath,
      status: res.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        path: normalizedPath,
        status: res.statusCode,
      },
      durationMs
    );

    // Log based on status code
    const logData = {
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      contentLength: res.get("content-length"),
    };

    if (res.statusCode >= 500) {
      req.log.error(logData, "Request failed with server error");
      errorsTotal.inc({ type: "server_error", code: res.statusCode });
    } else if (res.statusCode >= 400) {
      req.log.warn(logData, "Request failed with client error");
      errorsTotal.inc({ type: "client_error", code: res.statusCode });
    } else {
      req.log.info(logData, "Request completed");
    }

    // Alert on high latency
    if (durationMs > 5000) {
      await alertHighLatency(durationMs, normalizedPath, {
        correlationId,
        method: req.method,
      });
    }
  });

  // Handle request errors
  res.on("error", (error) => {
    req.log.error(
      {
        error: error.message,
        stack: error.stack,
      },
      "Request error"
    );
    errorsTotal.inc({ type: "request_error", code: "unknown" });
  });

  next();
};

/**
 * Normalize path for metrics to prevent cardinality explosion
 * Replace dynamic segments (UUIDs, IDs) with placeholders
 */
const normalizePath = (path) => {
  return (
    path
      // Replace UUIDs
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ":id"
      )
      // Replace numeric IDs
      .replace(/\/\d+(?=\/|$)/g, "/:id")
      // Replace hex strings (32+ chars)
      .replace(/\/[0-9a-f]{32,}/gi, "/:hash")
  );
};

/**
 * Error logging middleware
 * Should be registered after routes
 */
export const errorLogger = (err, req, res, next) => {
  const correlationId = req.correlationId || generateCorrelationId();

  logger.error(
    {
      correlationId,
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      statusCode: err.statusCode || 500,
    },
    "Unhandled error"
  );

  errorsTotal.inc({
    type: "unhandled_error",
    code: err.statusCode || 500,
  });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === "production";

  res.status(err.statusCode || 500).json({
    status: err.statusCode || 500,
    code: err.code || "INTERNAL_ERROR",
    error: isProduction ? "An internal error occurred" : err.message,
    correlationId,
  });
};

export default requestLogger;
