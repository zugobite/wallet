# 008 - Monitoring & Observability

This document covers the monitoring, logging, metrics, and alerting systems integrated into the Wallet API.

## Overview

The Wallet API includes production-ready observability features:

| Feature                | Implementation        | Purpose                              |
| ---------------------- | --------------------- | ------------------------------------ |
| **Structured Logging** | Pino                  | JSON logs with correlation IDs       |
| **Metrics**            | Prometheus-compatible | Performance & business metrics       |
| **Health Checks**      | Kubernetes-ready      | Liveness, readiness, detailed health |
| **Alerting**           | Configurable          | Threshold-based alerts with webhooks |

## Structured Logging

### Correlation IDs

Every request receives a unique correlation ID that flows through all log entries, making it easy to trace requests across services.

```
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
```

The correlation ID is:

- Generated automatically if not provided
- Extracted from `X-Correlation-ID` or `X-Request-ID` headers
- Returned in the response headers
- Included in all log entries for that request

### Log Levels

| Level   | Usage                                            |
| ------- | ------------------------------------------------ |
| `error` | System errors, unhandled exceptions              |
| `warn`  | Auth failures, invalid signatures, client errors |
| `info`  | Request completion, transactions, audit events   |
| `debug` | Detailed debugging (development only)            |

### Log Format

**Production** (JSON for log aggregators):

```json
{
  "level": "info",
  "time": "2025-12-31T10:30:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "service": "wallet-api",
  "version": "1.0.0",
  "method": "POST",
  "path": "/api/v1/transactions/authorize",
  "status": 201,
  "durationMs": 45.23,
  "msg": "Request completed"
}
```

**Development** (Pretty-printed):

```
[10:30:00] INFO: Request completed
    correlationId: "550e8400-e29b-41d4-a716-446655440000"
    method: "POST"
    path: "/api/v1/transactions/authorize"
    status: 201
    durationMs: 45.23
```

### Sensitive Data Redaction

The following fields are automatically redacted:

- `authorization` headers
- `x-signature` headers
- `password`, `secret`, `token` fields

### Audit Logging

Security-sensitive operations are logged with structured audit events:

```javascript
import { auditLog } from "./infra/logger.mjs";

// Authentication events
auditLog.authSuccess(correlationId, accountId);
auditLog.authFailure(correlationId, "invalid_token");

// Transaction events
auditLog.transaction(correlationId, "authorized", { transactionId, amount });

// Signature validation
auditLog.signatureValidation(correlationId, false, "timestamp_expired");

// Security events
auditLog.securityEvent(correlationId, "replay_attempt", { nonce });
```

## Metrics

### Prometheus Endpoint

Metrics are exposed at `GET /metrics` in Prometheus exposition format.

```bash
curl http://localhost:3000/metrics
```

### Available Metrics

#### HTTP Metrics

| Metric                            | Type      | Labels               | Description               |
| --------------------------------- | --------- | -------------------- | ------------------------- |
| `wallet_http_requests_total`      | Counter   | method, path, status | Total HTTP requests       |
| `wallet_http_request_duration_ms` | Histogram | method, path, status | Request duration          |
| `wallet_active_requests`          | Gauge     | -                    | Currently active requests |

#### Transaction Metrics

| Metric                      | Type      | Labels       | Description         |
| --------------------------- | --------- | ------------ | ------------------- |
| `wallet_transactions_total` | Counter   | type, status | Total transactions  |
| `wallet_transaction_amount` | Histogram | type         | Transaction amounts |

#### Authentication Metrics

| Metric                               | Type    | Labels         | Description           |
| ------------------------------------ | ------- | -------------- | --------------------- |
| `wallet_auth_attempts_total`         | Counter | result, reason | Auth attempts         |
| `wallet_signature_validations_total` | Counter | result         | Signature validations |

#### Infrastructure Metrics

| Metric                               | Type      | Labels            | Description           |
| ------------------------------------ | --------- | ----------------- | --------------------- |
| `wallet_db_query_duration_ms`        | Histogram | operation, table  | DB query duration     |
| `wallet_db_connections_active`       | Gauge     | -                 | Active DB connections |
| `wallet_redis_operations_total`      | Counter   | operation, result | Redis operations      |
| `wallet_redis_operation_duration_ms` | Histogram | operation         | Redis op duration     |

#### Error Metrics

| Metric                | Type    | Labels     | Description  |
| --------------------- | ------- | ---------- | ------------ |
| `wallet_errors_total` | Counter | type, code | Total errors |

#### Process Metrics

| Metric                           | Type  | Description       |
| -------------------------------- | ----- | ----------------- |
| `process_memory_heap_used_bytes` | Gauge | Heap memory used  |
| `process_memory_rss_bytes`       | Gauge | Resident set size |
| `process_uptime_seconds`         | Gauge | Process uptime    |

### Using Metrics in Code

```javascript
import {
  transactionsTotal,
  transactionAmount,
  dbQueryDuration,
} from "./infra/metrics.mjs";

// Increment counter
transactionsTotal.inc({ type: "authorize", status: "success" });

// Observe histogram value
transactionAmount.observe({ type: "debit" }, 1500);

// Time a database operation
const endTimer = dbQueryDuration.startTimer({
  operation: "insert",
  table: "transactions",
});
await performQuery();
const durationMs = endTimer(); // Automatically records duration
```

### Grafana Dashboard

Example Prometheus queries for Grafana:

```promql
# Request rate (requests per second)
rate(wallet_http_requests_total[5m])

# Error rate percentage
sum(rate(wallet_http_requests_total{status=~"5.."}[5m]))
/ sum(rate(wallet_http_requests_total[5m])) * 100

# 95th percentile latency
histogram_quantile(0.95, rate(wallet_http_request_duration_ms_bucket[5m]))

# Transaction success rate
sum(rate(wallet_transactions_total{status="success"}[5m]))
/ sum(rate(wallet_transactions_total[5m])) * 100
```

## Health Checks

### Endpoints

| Endpoint            | Purpose         | Use Case                    |
| ------------------- | --------------- | --------------------------- |
| `GET /health/live`  | Liveness probe  | Kubernetes `livenessProbe`  |
| `GET /health/ready` | Readiness probe | Kubernetes `readinessProbe` |
| `GET /health`       | Detailed health | Monitoring dashboards       |

### Liveness Probe

Simple check that the process is running:

```bash
curl http://localhost:3000/health/live
```

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "alive": true,
    "timestamp": "2025-12-31T10:30:00.000Z"
  }
}
```

### Readiness Probe

Checks if the service can accept traffic (database & Redis connected):

```bash
curl http://localhost:3000/health/ready
```

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "ready": true,
    "status": "healthy",
    "timestamp": "2025-12-31T10:30:00.000Z",
    "components": {
      "database": { "status": "healthy", "latencyMs": 5 },
      "redis": { "status": "healthy", "latencyMs": 2 }
    }
  }
}
```

### Detailed Health

Full health status with process information:

```bash
curl http://localhost:3000/health
```

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "service": "wallet-api",
    "version": "1.0.0",
    "status": "healthy",
    "timestamp": "2025-12-31T10:30:00.000Z",
    "uptime": 3600,
    "components": {
      "database": { "status": "healthy", "latencyMs": 5 },
      "redis": { "status": "healthy", "latencyMs": 2 }
    },
    "process": {
      "pid": 12345,
      "memoryUsage": {
        "heapUsed": 45,
        "heapTotal": 65,
        "rss": 90
      }
    }
  }
}
```

### Health Status Values

| Status      | Meaning                    | HTTP Code |
| ----------- | -------------------------- | --------- |
| `healthy`   | All components operational | 200       |
| `degraded`  | Some components impaired   | 200       |
| `unhealthy` | Critical components down   | 503       |

### Kubernetes Configuration

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: wallet-api
      livenessProbe:
        httpGet:
          path: /health/live
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 15
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /health/ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 10
        failureThreshold: 3
```

## Alerting

### Configuration

Configure alerting via environment variables or code:

```javascript
import { configure } from "./infra/alerting.mjs";

configure({
  errorRateThreshold: 10, // errors per minute
  latencyThreshold: 5000, // ms
  authFailureThreshold: 20, // failures per minute
  cooldownPeriod: 300000, // 5 minutes
  channels: ["log", "webhook"],
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
});
```

### Environment Variables

| Variable            | Description                 | Default                      |
| ------------------- | --------------------------- | ---------------------------- |
| `ALERT_WEBHOOK_URL` | Slack/PagerDuty webhook URL | -                            |
| `LOG_LEVEL`         | Logging level               | `info` (prod), `debug` (dev) |

### Alert Types

| Alert                 | Severity         | Trigger                           |
| --------------------- | ---------------- | --------------------------------- |
| `high_error_rate`     | Warning/Critical | Error rate exceeds threshold      |
| `high_latency`        | Warning/Critical | Request latency exceeds threshold |
| `auth_failure_spike`  | Critical         | Auth failures spike               |
| `database_error`      | Critical         | Database connectivity issues      |
| `redis_error`         | Warning          | Redis connectivity issues         |
| `transaction_failure` | Warning          | Transaction processing failures   |
| `signature_attack`    | Critical         | Repeated invalid signatures       |

### Using Alerts

```javascript
import {
  alertHighErrorRate,
  alertHighLatency,
  alertDatabaseError,
  triggerAlert,
  AlertType,
  AlertSeverity,
} from "./infra/alerting.mjs";

// Pre-built alerts
await alertHighLatency(6000, "/api/v1/transactions/authorize");
await alertDatabaseError(error, "insert");

// Custom alert
await triggerAlert(
  AlertType.TRANSACTION_FAILURE,
  AlertSeverity.WARNING,
  "Transaction failed: insufficient funds",
  { walletId, amount, balance }
);
```

### Webhook Payload (Slack Format)

```json
{
  "text": "🚨 *CRITICAL*: High error rate detected: 15.2 errors/min",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        { "title": "Type", "value": "high_error_rate", "short": true },
        { "title": "Severity", "value": "critical", "short": true },
        { "title": "Details", "value": "{\"errorCount\": 76, \"rate\": 15.2}" },
        {
          "title": "Timestamp",
          "value": "2025-12-31T10:30:00.000Z",
          "short": true
        }
      ]
    }
  ]
}
```

## Integration Examples

### ELK Stack (Elasticsearch, Logstash, Kibana)

Forward Pino JSON logs to Logstash:

```yaml
# logstash.conf
input {
file {
path => "/var/log/wallet-api/*.log"
codec => json
}
}

filter {
mutate {
add_field => { "[@metadata][index]" => "wallet-api" }
}
}

output {
elasticsearch {
hosts => ["elasticsearch:9200"]
index => "%{[@metadata][index]}-%{+YYYY.MM.dd}"
}
}
```

### Prometheus Scrape Config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: "wallet-api"
    static_configs:
      - targets: ["wallet-api:3000"]
    metrics_path: "/metrics"
    scrape_interval: 15s
```

### CloudWatch (AWS)

Use Pino to CloudWatch transport:

```bash
npm install pino-cloudwatch
```

```javascript
// For AWS Lambda / ECS
import pino from "pino";
import pinoCloudWatch from "pino-cloudwatch";

const logger = pino({
  transport: {
    target: "pino-cloudwatch",
    options: {
      group: "/wallet-api/logs",
      stream: process.env.AWS_LAMBDA_FUNCTION_NAME || "default",
    },
  },
});
```

### Datadog

```bash
npm install pino-datadog
```

Configure Datadog agent to collect metrics from `/metrics` endpoint.

## Best Practices

1. **Always include correlation IDs** in logs for distributed tracing
2. **Use structured logging** - avoid string concatenation in log messages
3. **Set appropriate log levels** - use `debug` for development only
4. **Monitor key metrics** - error rates, latency percentiles, transaction volumes
5. **Configure alerts** - don't just collect metrics, act on them
6. **Redact sensitive data** - never log secrets, tokens, or PII
7. **Use health checks** - implement proper Kubernetes probes
8. **Aggregate logs** - use centralized logging (ELK, CloudWatch, etc.)

## Environment Variables

| Variable            | Description       | Default                      |
| ------------------- | ----------------- | ---------------------------- |
| `LOG_LEVEL`         | Logging level     | `info` (prod), `debug` (dev) |
| `NODE_ENV`          | Environment       | `development`                |
| `ALERT_WEBHOOK_URL` | Alert webhook URL | -                            |

## File Structure

```
src/infra/
├── logger.mjs       # Structured logging with Pino
├── metrics.mjs      # Prometheus-compatible metrics
└── alerting.mjs     # Threshold-based alerting

src/middleware/
├── requestLogger.mjs  # Request logging middleware
└── healthCheck.mjs    # Health check handlers
```
