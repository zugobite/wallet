/**
 * Prometheus-compatible metrics collection
 * Lightweight implementation without external dependencies
 */

// Metric storage
const metrics = {
  counters: new Map(),
  histograms: new Map(),
  gauges: new Map(),
};

// Histogram buckets for response times (in ms)
const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Counter metric - monotonically increasing value
 */
class Counter {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map();
  }

  inc(labels = {}, value = 1) {
    const key = this._labelKey(labels);
    const current = this.values.get(key) || { value: 0, labels };
    current.value += value;
    this.values.set(key, current);
  }

  _labelKey(labels) {
    return JSON.stringify(labels);
  }

  collect() {
    const result = [];
    for (const [, data] of this.values) {
      result.push({
        labels: data.labels,
        value: data.value,
      });
    }
    return result;
  }
}

/**
 * Histogram metric - tracks distribution of values
 */
class Histogram {
  constructor(name, help, labelNames = [], buckets = DEFAULT_BUCKETS) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.buckets = buckets.sort((a, b) => a - b);
    this.values = new Map();
  }

  observe(labels = {}, value) {
    const key = this._labelKey(labels);
    let data = this.values.get(key);

    if (!data) {
      data = {
        labels,
        buckets: this.buckets.reduce((acc, b) => ({ ...acc, [b]: 0 }), {}),
        sum: 0,
        count: 0,
      };
      this.values.set(key, data);
    }

    data.sum += value;
    data.count += 1;

    for (const bucket of this.buckets) {
      if (value <= bucket) {
        data.buckets[bucket] += 1;
      }
    }
  }

  startTimer(labels = {}) {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      this.observe(labels, durationMs);
      return durationMs;
    };
  }

  _labelKey(labels) {
    return JSON.stringify(labels);
  }

  collect() {
    const result = [];
    for (const [, data] of this.values) {
      result.push({
        labels: data.labels,
        buckets: data.buckets,
        sum: data.sum,
        count: data.count,
      });
    }
    return result;
  }
}

/**
 * Gauge metric - value that can go up or down
 */
class Gauge {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map();
  }

  set(labels = {}, value) {
    const key = this._labelKey(labels);
    this.values.set(key, { labels, value });
  }

  inc(labels = {}, value = 1) {
    const key = this._labelKey(labels);
    const current = this.values.get(key) || { labels, value: 0 };
    current.value += value;
    this.values.set(key, current);
  }

  dec(labels = {}, value = 1) {
    this.inc(labels, -value);
  }

  _labelKey(labels) {
    return JSON.stringify(labels);
  }

  collect() {
    const result = [];
    for (const [, data] of this.values) {
      result.push({
        labels: data.labels,
        value: data.value,
      });
    }
    return result;
  }
}

// ============================================================================
// Pre-defined Application Metrics
// ============================================================================

/**
 * HTTP request metrics
 */
export const httpRequestsTotal = new Counter(
  "wallet_http_requests_total",
  "Total number of HTTP requests",
  ["method", "path", "status"]
);

export const httpRequestDuration = new Histogram(
  "wallet_http_request_duration_ms",
  "HTTP request duration in milliseconds",
  ["method", "path", "status"]
);

/**
 * Transaction metrics
 */
export const transactionsTotal = new Counter(
  "wallet_transactions_total",
  "Total number of transactions",
  ["type", "status"]
);

export const transactionAmount = new Histogram(
  "wallet_transaction_amount",
  "Transaction amounts",
  ["type"],
  [10, 100, 500, 1000, 5000, 10000, 50000, 100000]
);

/**
 * Authentication metrics
 */
export const authAttemptsTotal = new Counter(
  "wallet_auth_attempts_total",
  "Total authentication attempts",
  ["result", "reason"]
);

/**
 * Signature validation metrics
 */
export const signatureValidationsTotal = new Counter(
  "wallet_signature_validations_total",
  "Total signature validations",
  ["result"]
);

/**
 * Database metrics
 */
export const dbQueryDuration = new Histogram(
  "wallet_db_query_duration_ms",
  "Database query duration in milliseconds",
  ["operation", "table"]
);

export const dbConnectionsActive = new Gauge(
  "wallet_db_connections_active",
  "Number of active database connections"
);

/**
 * Redis metrics
 */
export const redisOperationsTotal = new Counter(
  "wallet_redis_operations_total",
  "Total Redis operations",
  ["operation", "result"]
);

export const redisOperationDuration = new Histogram(
  "wallet_redis_operation_duration_ms",
  "Redis operation duration in milliseconds",
  ["operation"]
);

/**
 * Error metrics
 */
export const errorsTotal = new Counter(
  "wallet_errors_total",
  "Total number of errors",
  ["type", "code"]
);

/**
 * Active requests gauge
 */
export const activeRequests = new Gauge(
  "wallet_active_requests",
  "Number of currently active requests"
);

// ============================================================================
// Metrics Collection
// ============================================================================

/**
 * Collect all metrics in Prometheus exposition format
 * @returns {string} Prometheus-formatted metrics
 */
export const collectMetrics = () => {
  const lines = [];

  // Add process metrics
  const memUsage = process.memoryUsage();
  lines.push("# HELP process_memory_heap_used_bytes Process heap memory used");
  lines.push("# TYPE process_memory_heap_used_bytes gauge");
  lines.push(`process_memory_heap_used_bytes ${memUsage.heapUsed}`);

  lines.push("# HELP process_memory_rss_bytes Process resident set size");
  lines.push("# TYPE process_memory_rss_bytes gauge");
  lines.push(`process_memory_rss_bytes ${memUsage.rss}`);

  lines.push("# HELP process_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);

  // Collect counters
  const counters = [
    httpRequestsTotal,
    transactionsTotal,
    authAttemptsTotal,
    signatureValidationsTotal,
    redisOperationsTotal,
    errorsTotal,
  ];

  for (const counter of counters) {
    lines.push(`# HELP ${counter.name} ${counter.help}`);
    lines.push(`# TYPE ${counter.name} counter`);
    for (const item of counter.collect()) {
      const labelStr = formatLabels(item.labels);
      lines.push(`${counter.name}${labelStr} ${item.value}`);
    }
  }

  // Collect histograms
  const histograms = [
    httpRequestDuration,
    transactionAmount,
    dbQueryDuration,
    redisOperationDuration,
  ];

  for (const histogram of histograms) {
    lines.push(`# HELP ${histogram.name} ${histogram.help}`);
    lines.push(`# TYPE ${histogram.name} histogram`);
    for (const item of histogram.collect()) {
      const labelStr = formatLabels(item.labels);
      let cumulative = 0;
      for (const bucket of histogram.buckets) {
        cumulative += item.buckets[bucket] || 0;
        lines.push(
          `${histogram.name}_bucket${addLabel(labelStr, "le", bucket)} ${cumulative}`
        );
      }
      lines.push(
        `${histogram.name}_bucket${addLabel(labelStr, "le", "+Inf")} ${item.count}`
      );
      lines.push(`${histogram.name}_sum${labelStr} ${item.sum}`);
      lines.push(`${histogram.name}_count${labelStr} ${item.count}`);
    }
  }

  // Collect gauges
  const gauges = [dbConnectionsActive, activeRequests];

  for (const gauge of gauges) {
    lines.push(`# HELP ${gauge.name} ${gauge.help}`);
    lines.push(`# TYPE ${gauge.name} gauge`);
    for (const item of gauge.collect()) {
      const labelStr = formatLabels(item.labels);
      lines.push(`${gauge.name}${labelStr} ${item.value}`);
    }
  }

  return lines.join("\n");
};

/**
 * Format labels for Prometheus exposition format
 */
const formatLabels = (labels) => {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  const formatted = entries.map(([k, v]) => `${k}="${v}"`).join(",");
  return `{${formatted}}`;
};

/**
 * Add a label to existing label string
 */
const addLabel = (labelStr, key, value) => {
  if (labelStr === "") {
    return `{${key}="${value}"}`;
  }
  return labelStr.slice(0, -1) + `,${key}="${value}"}`;
};

/**
 * Reset all metrics (useful for testing)
 */
export const resetMetrics = () => {
  httpRequestsTotal.values.clear();
  httpRequestDuration.values.clear();
  transactionsTotal.values.clear();
  transactionAmount.values.clear();
  authAttemptsTotal.values.clear();
  signatureValidationsTotal.values.clear();
  dbQueryDuration.values.clear();
  dbConnectionsActive.values.clear();
  redisOperationsTotal.values.clear();
  redisOperationDuration.values.clear();
  errorsTotal.values.clear();
  activeRequests.values.clear();
};

export default {
  httpRequestsTotal,
  httpRequestDuration,
  transactionsTotal,
  transactionAmount,
  authAttemptsTotal,
  signatureValidationsTotal,
  dbQueryDuration,
  dbConnectionsActive,
  redisOperationsTotal,
  redisOperationDuration,
  errorsTotal,
  activeRequests,
  collectMetrics,
  resetMetrics,
};
