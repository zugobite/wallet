# 009 - Scaling Guide

This document outlines the architecture and implementation changes required to scale the Wallet API to handle **100 million+ transactions per day**.

## Table of Contents

- [Current Capacity](#current-capacity)
- [Target Requirements](#target-requirements)
- [Scaling Architecture](#scaling-architecture)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Quick Wins](#phase-1-quick-wins)
  - [Phase 2: Horizontal Scaling](#phase-2-horizontal-scaling)
  - [Phase 3: Database Optimization](#phase-3-database-optimization)
  - [Phase 4: Async Processing](#phase-4-async-processing)
- [Infrastructure Components](#infrastructure-components)
- [Monitoring at Scale](#monitoring-at-scale)
- [Cost Estimation](#cost-estimation)
- [Performance Testing](#performance-testing)

---

## Current Capacity

### Baseline Performance

| Metric                 | Current Capacity | Limiting Factor         |
| ---------------------- | ---------------- | ----------------------- |
| **Throughput**         | ~100-200 TPS     | Single Node.js instance |
| **Daily Transactions** | ~10-15 million   | Database connections    |
| **P99 Latency**        | ~50-100ms        | Synchronous DB writes   |
| **Concurrent Users**   | ~1,000           | Connection pool size    |

### Current Bottlenecks

```
┌───────────────────────────────────────────────────────────────┐
│                    Current Architecture                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   Client ──▶ Single Node.js ──▶ Single MySQL ──▶ Single Redis │
│                    │                  │              │        │
│                    ▼                  ▼              ▼        │
│              ❌ No scaling    ❌ No replicas   ❌ No cluster   │
│              ❌ 10 DB conns   ❌ No sharding   ❌ Single point │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Target Requirements

### 100 Million Transactions/Day

| Metric              | Requirement      | Calculation                |
| ------------------- | ---------------- | -------------------------- |
| **Average TPS**     | ~1,160 TPS       | 100M ÷ 86,400 seconds      |
| **Peak TPS**        | ~3,500-5,000 TPS | 3-4x average for spikes    |
| **P99 Latency**     | < 100ms          | User experience target     |
| **Availability**    | 99.99%           | < 52 min downtime/year     |
| **Data Durability** | 99.999999999%    | Financial data requirement |

---

## Scaling Architecture

### Target Architecture (100M+ TPS)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Load Balancer                               │
│                    (AWS ALB / Nginx / HAProxy)                      │
│                         Health Checks                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                            │
│                    (Rate Limiting, Auth Cache)                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│   Node.js     │         │   Node.js     │         │   Node.js     │
│  Instance 1   │         │  Instance 2   │   ...   │  Instance N   │
│  (4 workers)  │         │  (4 workers)  │         │  (4 workers)  │
└───────────────┘         └───────────────┘         └───────────────┘
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│ Redis Cluster │         │ Redis Cluster │         │ Redis Cluster │
│    Node 1     │◀───────▶│    Node 2     │◀───────▶│    Node 3     │
│   (Primary)   │         │   (Primary)   │         │   (Primary)   │
└───────────────┘         └───────────────┘         └───────────────┘
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│    Replica    │         │    Replica    │         │    Replica    │
└───────────────┘         └───────────────┘         └───────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Message Queue                                │
│                    (Kafka / AWS SQS / RabbitMQ)                     │
│              Async: Ledger Writes, Notifications, Audit             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│    MySQL      │         │    MySQL      │         │    MySQL      │
│   Primary     │────────▶│  Read Rep 1   │         │  Read Rep N   │
│  (Writes)     │         │   (Reads)     │         │   (Reads)     │
└───────────────┘         └───────────────┘         └───────────────┘
        │
        ▼
┌───────────────┐
│   ProxySQL    │  ← Connection pooling & query routing
└───────────────┘
```

---

## Implementation Phases

### Phase 1: Quick Wins

**Timeline**: 1-2 days  
**Impact**: 2-3x throughput improvement  
**Effort**: Low

#### 1.1 Increase Database Connection Pool

```javascript
// prisma/schema.prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  // Increase connection pool
  connectionLimit = 50
}
```

Or via environment variable:

```bash
# .env
DATABASE_URL="mysql://user:pass@host:3306/wallet?connection_limit=50&pool_timeout=30"
```

#### 1.2 Enable Node.js Clustering with PM2

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "wallet-api",
      script: "src/app.mjs",
      instances: "max", // Use all CPU cores
      exec_mode: "cluster", // Enable cluster mode
      max_memory_restart: "1G", // Restart if memory exceeds 1GB
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.cjs

# Monitor
pm2 monit
```

#### 1.3 Add Response Compression

```javascript
// src/app.mjs
import compression from "compression";

app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
    level: 6, // Balance between speed and compression
  })
);
```

```bash
npm install compression
```

#### 1.4 Enable Keep-Alive Connections

```javascript
// src/app.mjs
import { createServer } from "http";

const server = createServer(app);

server.keepAliveTimeout = 65000; // Slightly higher than ALB timeout
server.headersTimeout = 66000;

server.listen(process.env.PORT || 3000);
```

---

### Phase 2: Horizontal Scaling

**Timeline**: 1-2 weeks  
**Impact**: 5-10x throughput improvement  
**Effort**: Medium

#### 2.1 Redis Cluster Configuration

```javascript
// src/infra/redis.mjs
import Redis from "ioredis";

const isCluster = process.env.REDIS_CLUSTER === "true";

export const redis = isCluster
  ? new Redis.Cluster(
      [
        { host: process.env.REDIS_NODE_1 || "redis-1", port: 6379 },
        { host: process.env.REDIS_NODE_2 || "redis-2", port: 6379 },
        { host: process.env.REDIS_NODE_3 || "redis-3", port: 6379 },
      ],
      {
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: 3,
        },
        scaleReads: "slave", // Read from replicas
        enableReadyCheck: true,
      }
    )
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || "0", 10),
    });

// Connection event handlers
redis.on("error", (err) => console.error("Redis error:", err));
redis.on("connect", () => console.log("Redis connected"));
```

#### 2.2 Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wallet-api
  labels:
    app: wallet-api
spec:
  replicas: 10 # Scale based on load
  selector:
    matchLabels:
      app: wallet-api
  template:
    metadata:
      labels:
        app: wallet-api
    spec:
      containers:
        - name: wallet-api
          image: wallet-api:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: wallet-secrets
                  key: database-url
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wallet-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: wallet-api
  minReplicas: 5
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

#### 2.3 Load Balancer Configuration (AWS ALB)

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wallet-api-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /health/ready
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: "15"
    alb.ingress.kubernetes.io/healthy-threshold-count: "2"
    alb.ingress.kubernetes.io/unhealthy-threshold-count: "3"
spec:
  rules:
    - host: api.wallet.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: wallet-api-service
                port:
                  number: 3000
```

---

### Phase 3: Database Optimization

**Timeline**: 2-4 weeks  
**Impact**: 10-20x throughput improvement  
**Effort**: High

#### 3.1 Read Replicas with Prisma

```javascript
// src/infra/prisma.mjs
import { PrismaClient } from "@prisma/client";

// Primary for writes
export const prismaWrite = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

// Read replicas for reads
export const prismaRead = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_REPLICA_URL },
  },
});

// Helper to choose appropriate client
export const prisma = {
  // Write operations use primary
  transaction: prismaWrite.transaction,
  wallet: {
    create: prismaWrite.wallet.create,
    update: prismaWrite.wallet.update,
    // Reads can use replica
    findUnique: prismaRead.wallet.findUnique,
    findMany: prismaRead.wallet.findMany,
  },
  // ... similar pattern for other models
};
```

#### 3.2 ProxySQL for Connection Pooling

```sql
-- ProxySQL configuration
-- Add MySQL servers
INSERT INTO mysql_servers (hostgroup_id, hostname, port, weight)
VALUES
  (10, 'mysql-primary', 3306, 1000),     -- Write group
  (20, 'mysql-replica-1', 3306, 500),    -- Read group
  (20, 'mysql-replica-2', 3306, 500);

-- Query routing rules
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup)
VALUES
  (1, 1, '^SELECT.*', 20),               -- SELECTs to read replicas
  (2, 1, '^(INSERT|UPDATE|DELETE).*', 10); -- Writes to primary

-- Connection pool settings
UPDATE global_variables
SET variable_value = 200
WHERE variable_name = 'mysql-max_connections';
```

#### 3.3 Database Sharding Strategy

For extreme scale, shard by `account_id`:

```javascript
// src/infra/sharding.mjs

/**
 * Determine shard for a given account
 * Uses consistent hashing for even distribution
 */
export const getShardId = (accountId) => {
  const hash = crypto.createHash("md5").update(accountId).digest("hex");
  const numericHash = parseInt(hash.substring(0, 8), 16);
  const shardCount = parseInt(process.env.SHARD_COUNT || "4", 10);
  return numericHash % shardCount;
};

/**
 * Get Prisma client for specific shard
 */
export const getShardClient = (accountId) => {
  const shardId = getShardId(accountId);
  const shardUrl = process.env[`DATABASE_SHARD_${shardId}_URL`];

  // Cache clients to avoid recreation
  if (!shardClients.has(shardId)) {
    shardClients.set(
      shardId,
      new PrismaClient({
        datasources: { db: { url: shardUrl } },
      })
    );
  }

  return shardClients.get(shardId);
};
```

#### 3.4 Database Indexes

```sql
-- Essential indexes for high-throughput queries
CREATE INDEX idx_transactions_wallet_status
ON transactions (wallet_id, status);

CREATE INDEX idx_transactions_reference
ON transactions (reference_id);

CREATE INDEX idx_transactions_created
ON transactions (created_at DESC);

CREATE INDEX idx_ledger_wallet_created
ON ledger (wallet_id, created_at DESC);

CREATE INDEX idx_wallet_account
ON wallets (account_id);

-- Partial index for pending transactions (most queried)
CREATE INDEX idx_transactions_pending
ON transactions (wallet_id, created_at)
WHERE status = 'PENDING';
```

---

### Phase 4: Async Processing

**Timeline**: 2-4 weeks  
**Impact**: Reduces latency, increases throughput  
**Effort**: High

#### 4.1 Message Queue Integration (BullMQ)

```javascript
// src/infra/queue.mjs
import { Queue, Worker } from "bullmq";
import { redis } from "./redis.mjs";

// Queue for async ledger writes
export const ledgerQueue = new Queue("ledger-writes", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Queue for notifications
export const notificationQueue = new Queue("notifications", {
  connection: redis,
});

// Ledger worker
export const ledgerWorker = new Worker(
  "ledger-writes",
  async (job) => {
    const { transactionId, walletId, amount, type, balanceAfter } = job.data;

    await prisma.ledger.create({
      data: {
        transactionId,
        walletId,
        amount,
        type,
        balanceAfter,
        createdAt: new Date(),
      },
    });
  },
  {
    connection: redis,
    concurrency: 50, // Process 50 jobs concurrently
  }
);

ledgerWorker.on("failed", (job, err) => {
  console.error(`Ledger job ${job.id} failed:`, err);
});
```

#### 4.2 Async Transaction Handler

```javascript
// src/handlers/debit.mjs (optimized)
import { ledgerQueue } from "../infra/queue.mjs";

export const debitHandler = async (req, res) => {
  const { transactionId } = req.body;

  // Fast path: Update transaction and wallet in single DB transaction
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.update({
      where: { id: transactionId, status: "PENDING" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    const wallet = await tx.wallet.update({
      where: { id: transaction.walletId },
      data: { balance: { decrement: transaction.amount } },
    });

    return { transaction, wallet };
  });

  // Async: Queue ledger write (non-blocking)
  await ledgerQueue.add("create-ledger", {
    transactionId: result.transaction.id,
    walletId: result.wallet.id,
    amount: result.transaction.amount,
    type: "DEBIT",
    balanceAfter: result.wallet.balance,
  });

  // Respond immediately
  res.status(200).json({
    status: 200,
    code: "OK",
    data: { transaction: result.transaction },
  });
};
```

#### 4.3 Event Sourcing (Optional - Maximum Scale)

```javascript
// src/infra/eventStore.mjs
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "wallet-api",
  brokers: process.env.KAFKA_BROKERS.split(","),
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: "wallet-processors" });

// Publish transaction event
export const publishEvent = async (topic, event) => {
  await producer.send({
    topic,
    messages: [
      {
        key: event.aggregateId,
        value: JSON.stringify({
          ...event,
          timestamp: Date.now(),
          version: 1,
        }),
      },
    ],
  });
};

// Usage in handler
await publishEvent("transactions", {
  type: "TRANSACTION_COMPLETED",
  aggregateId: transactionId,
  data: { amount, walletId, balanceAfter },
});
```

---

## Infrastructure Components

### Recommended Stack for 100M TPS

| Component            | Technology           | Specification                   |
| -------------------- | -------------------- | ------------------------------- |
| **Load Balancer**    | AWS ALB / Nginx      | 2+ instances, auto-scaling      |
| **API Servers**      | Node.js + PM2        | 10-20 instances, 4 cores each   |
| **Cache/Sessions**   | Redis Cluster        | 6 nodes (3 primary + 3 replica) |
| **Message Queue**    | Kafka / SQS          | 3+ brokers, partitioned topics  |
| **Database (Write)** | MySQL 8.x            | db.r6g.2xlarge or equivalent    |
| **Database (Read)**  | MySQL Replicas       | 2-4 read replicas               |
| **Connection Pool**  | ProxySQL             | 2 instances (HA)                |
| **Monitoring**       | Prometheus + Grafana | Dedicated monitoring cluster    |

### AWS Architecture Example

```
┌─────────────────────────────────────────────────────────────────┐
│                          Route 53                               │
│                      (DNS + Health Checks)                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CloudFront (Optional)                      │
│                         (Edge Caching)                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Load Balancer                    │
│                      (Cross-Zone, HTTPS)                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         EKS Cluster                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ Pod 1   │  │ Pod 2   │  │ Pod 3   │  │ Pod N   │   (HPA)     │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ElastiCache (Redis Cluster)                  │
│              (3 shards × 2 replicas = 6 nodes)                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Amazon SQS                             │
│                    (Transaction Events Queue)                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Aurora MySQL Cluster                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │    Writer     │  │   Reader 1    │  │   Reader 2    │        │
│  │  (Primary)    │  │   (Replica)   │  │   (Replica)   │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monitoring at Scale

### Key Metrics to Track

```yaml
# Prometheus alerting rules
groups:
  - name: wallet-api-alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          sum(rate(wallet_http_requests_total{status=~"5.."}[5m])) 
          / sum(rate(wallet_http_requests_total[5m])) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 1%"

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, 
            rate(wallet_http_request_duration_ms_bucket[5m])
          ) > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency > 500ms"

      # Low throughput (potential issue)
      - alert: LowThroughput
        expr: |
          sum(rate(wallet_transactions_total[5m])) < 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Transaction rate dropped below 100 TPS"

      # Database connection saturation
      - alert: DatabaseConnectionSaturation
        expr: |
          wallet_db_connections_active 
          / wallet_db_connections_max > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connections > 80% capacity"
```

### Grafana Dashboard Queries

```promql
# Transaction throughput
sum(rate(wallet_transactions_total[1m]))

# Success rate
sum(rate(wallet_transactions_total{status="success"}[5m]))
/ sum(rate(wallet_transactions_total[5m])) * 100

# P50, P95, P99 latency
histogram_quantile(0.50, rate(wallet_http_request_duration_ms_bucket[5m]))
histogram_quantile(0.95, rate(wallet_http_request_duration_ms_bucket[5m]))
histogram_quantile(0.99, rate(wallet_http_request_duration_ms_bucket[5m]))

# Active connections by component
wallet_db_connections_active
wallet_redis_connections_active

# Error breakdown
sum by (type, code) (rate(wallet_errors_total[5m]))
```

---

## Cost Estimation

### AWS Monthly Cost (100M TPS Target)

| Component                     | Specification                         | Monthly Cost (USD)       |
| ----------------------------- | ------------------------------------- | ------------------------ |
| **EKS Cluster**               | Control plane + 10 nodes (c6i.xlarge) | ~$2,500                  |
| **Aurora MySQL**              | db.r6g.2xlarge writer + 2 readers     | ~$3,000                  |
| **ElastiCache Redis**         | 6 × cache.r6g.large                   | ~$1,800                  |
| **Application Load Balancer** | With 100M requests                    | ~$500                    |
| **SQS**                       | 100M messages/day                     | ~$40                     |
| **CloudWatch**                | Logs + Metrics                        | ~$300                    |
| **Data Transfer**             | ~5TB/month                            | ~$450                    |
| **Total**                     |                                       | **~$8,500-10,000/month** |

### Cost Optimization Tips

1. **Use Spot Instances** for non-critical workers (50-70% savings)
2. **Reserved Instances** for databases (30-40% savings)
3. **Auto-scaling** to reduce off-peak capacity
4. **Compress responses** to reduce data transfer
5. **Cache aggressively** to reduce database load

---

## Performance Testing

### Load Testing with k6

```javascript
// loadtest/stress-test.js
import http from "k6/http";
import { check, sleep } from "k6";
import { randomUUID } from "k6/crypto";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up
    { duration: "5m", target: 500 }, // Stay at 500 users
    { duration: "2m", target: 1000 }, // Push to 1000
    { duration: "5m", target: 1000 }, // Stay at peak
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(99)<500"], // 99% under 500ms
    http_req_failed: ["rate<0.01"], // Error rate < 1%
  },
};

export default function () {
  const payload = JSON.stringify({
    walletId: "test-wallet-001",
    amount: Math.floor(Math.random() * 1000) + 1,
    referenceId: randomUUID(),
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${__ENV.TEST_TOKEN}`,
      "X-Idempotency-Key": randomUUID(),
    },
  };

  const res = http.post(
    `${__ENV.API_URL}/api/v1/transactions/authorize`,
    payload,
    params
  );

  check(res, {
    "status is 201": (r) => r.status === 201,
    "response time < 200ms": (r) => r.timings.duration < 200,
  });

  sleep(0.1); // 10 requests per second per VU
}
```

```bash
# Run load test
k6 run --env API_URL=https://api.wallet.example.com \
       --env TEST_TOKEN=xxx \
       loadtest/stress-test.js
```

### Benchmarking Results Target

| Metric           | Target      | Acceptable  |
| ---------------- | ----------- | ----------- |
| **Throughput**   | > 1,500 TPS | > 1,000 TPS |
| **P50 Latency**  | < 50ms      | < 100ms     |
| **P95 Latency**  | < 100ms     | < 200ms     |
| **P99 Latency**  | < 200ms     | < 500ms     |
| **Error Rate**   | < 0.1%      | < 1%        |
| **CPU Usage**    | < 70%       | < 85%       |
| **Memory Usage** | < 70%       | < 85%       |

---

## Summary

### Scaling Roadmap

| Phase       | Timeline  | Investment | Capacity   |
| ----------- | --------- | ---------- | ---------- |
| **Current** | -         | -          | ~15M/day   |
| **Phase 1** | 1-2 days  | Low        | ~40M/day   |
| **Phase 2** | 1-2 weeks | Medium     | ~100M/day  |
| **Phase 3** | 2-4 weeks | High       | ~250M/day  |
| **Phase 4** | 2-4 weeks | High       | ~500M+/day |

### Key Takeaways

1. **Start with quick wins** - Connection pooling and clustering provide immediate benefits
2. **Scale horizontally** - Add more instances rather than bigger machines
3. **Separate reads and writes** - Use read replicas for balance queries
4. **Go async** - Queue non-critical operations (ledger, notifications)
5. **Monitor everything** - You can't optimize what you don't measure
6. **Test under load** - Regular performance testing catches regressions

---

## Related Documentation

- [007-DEPLOYMENT.md](007-DEPLOYMENT.md) - Basic deployment guide
- [008-MONITORING.md](008-MONITORING.md) - Monitoring setup
- [005-DATABASE_SCHEMA.md](005-DATABASE_SCHEMA.md) - Database design
