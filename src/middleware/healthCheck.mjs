import { prisma } from "../infra/prisma.mjs";
import redis from "../infra/redis.mjs";
import logger from "../infra/logger.mjs";

/**
 * Health check types
 */
export const HealthStatus = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  UNHEALTHY: "unhealthy",
};

/**
 * Check database connectivity
 */
const checkDatabase = async () => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: HealthStatus.HEALTHY,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.error({ error: error.message }, "Database health check failed");
    return {
      status: HealthStatus.UNHEALTHY,
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
};

/**
 * Check Redis connectivity
 */
const checkRedis = async () => {
  const start = Date.now();
  try {
    await redis.ping();
    return {
      status: HealthStatus.HEALTHY,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.error({ error: error.message }, "Redis health check failed");
    return {
      status: HealthStatus.UNHEALTHY,
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
};

/**
 * Calculate overall health from component statuses
 */
const calculateOverallHealth = (components) => {
  const statuses = Object.values(components).map((c) => c.status);

  if (statuses.every((s) => s === HealthStatus.HEALTHY)) {
    return HealthStatus.HEALTHY;
  }

  if (statuses.some((s) => s === HealthStatus.UNHEALTHY)) {
    // If critical components are down, we're unhealthy
    if (
      components.database?.status === HealthStatus.UNHEALTHY ||
      components.redis?.status === HealthStatus.UNHEALTHY
    ) {
      return HealthStatus.UNHEALTHY;
    }
    return HealthStatus.DEGRADED;
  }

  return HealthStatus.DEGRADED;
};

/**
 * Simple liveness probe - is the process running?
 * Kubernetes: livenessProbe
 */
export const livenessHandler = (req, res) => {
  res.status(200).json({
    status: 200,
    code: "OK",
    data: {
      alive: true,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Readiness probe - is the service ready to accept traffic?
 * Kubernetes: readinessProbe
 */
export const readinessHandler = async (req, res) => {
  try {
    const components = {
      database: await checkDatabase(),
      redis: await checkRedis(),
    };

    const overallStatus = calculateOverallHealth(components);
    const isReady = overallStatus !== HealthStatus.UNHEALTHY;

    const response = {
      status: isReady ? 200 : 503,
      code: isReady ? "OK" : "SERVICE_UNAVAILABLE",
      data: {
        ready: isReady,
        status: overallStatus,
        timestamp: new Date().toISOString(),
        components,
      },
    };

    res.status(response.status).json(response);
  } catch (error) {
    logger.error({ error: error.message }, "Readiness check error");
    res.status(503).json({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      data: {
        ready: false,
        status: HealthStatus.UNHEALTHY,
        error: "Health check failed",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Detailed health check with all component statuses
 */
export const healthHandler = async (req, res) => {
  try {
    const components = {
      database: await checkDatabase(),
      redis: await checkRedis(),
    };

    const overallStatus = calculateOverallHealth(components);
    const httpStatus =
      overallStatus === HealthStatus.HEALTHY
        ? 200
        : overallStatus === HealthStatus.DEGRADED
          ? 200
          : 503;

    const response = {
      status: httpStatus,
      code: httpStatus === 200 ? "OK" : "SERVICE_UNAVAILABLE",
      data: {
        service: "wallet-api",
        version: process.env.npm_package_version || "1.0.0",
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        components,
        process: {
          pid: process.pid,
          memoryUsage: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(
              process.memoryUsage().heapTotal / 1024 / 1024
            ),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
        },
      },
    };

    res.status(httpStatus).json(response);
  } catch (error) {
    logger.error({ error: error.message }, "Health check error");
    res.status(503).json({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      data: {
        status: HealthStatus.UNHEALTHY,
        error: "Health check failed",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

export default {
  HealthStatus,
  livenessHandler,
  readinessHandler,
  healthHandler,
};
