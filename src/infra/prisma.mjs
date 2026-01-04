import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Parse MariaDB connection URL into adapter config
 * Supports: mariadb://user:password@host:port/database
 */
function parseConnectionUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 3306,
    user: parsed.username,
    password: parsed.password || undefined,
    database: parsed.pathname.slice(1), // Remove leading '/'
    // Pool configuration
    connectionLimit: 10,
    acquireTimeout: 10000,
    connectTimeout: 10000,
    idleTimeout: 60000,
    minDelayValidation: 500,
  };
}

const adapterConfig = parseConnectionUrl(process.env.DATABASE_ADAPTER_URL);
const adapter = new PrismaMariaDb(adapterConfig);

export const prisma = new PrismaClient({ 
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

/**
 * Gracefully close database connections
 * Should be called on application shutdown
 */
export async function closeDatabaseConnections() {
  await prisma.$disconnect();
}
