# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-01

### Changed

- **Financial Math Engine** - Migrated from `decimal.js` to `monetra` for handling financial calculations.
  - Switched to BigInt-based integer math for precision.
  - Updated all domain logic and services to use `Money` objects.
  - Database now stores minor units as integers (casted from BigInt).

## [1.0.0] - 2025-12-31

### 🎉 Initial Release

This is the first public release of the Wallet Transaction API, a secure, production-ready financial transaction system with two-phase debit authorization.

### Added

#### Core API

- **Two-phase debit authorization** - Authorize → Debit/Reverse pattern for safe fund holds
- **Transaction endpoints**:
  - `POST /api/v1/transactions/authorize` - Create pending debit authorization
  - `POST /api/v1/transactions/debit` - Complete authorized transaction
  - `POST /api/v1/transactions/credit` - Direct credit to wallet
  - `POST /api/v1/transactions/reverse` - Reverse pending authorization
- **RESTful API design** with consistent JSON response format
- **Serverless support** via `serverless-http` for AWS Lambda deployment

#### Security

- **JWT authentication** with configurable secrets
- **HMAC-SHA256 request signing** for cryptographic request integrity
- **Replay protection** with nonce-based validation via Redis
- **Idempotent operations** with `referenceId` tracking
- **Sensitive data redaction** in logs (tokens, passwords, signatures)

#### Database

- **Prisma ORM** (v7.x) with MySQL/MariaDB adapter
- **Database schema** with Account, Wallet, Transaction, and Ledger models
- **Full audit trail** with balance snapshots in ledger entries
- **Migration system** for version-controlled schema changes

#### Monitoring & Observability

- **Structured logging** with Pino:
  - JSON output for production log aggregators
  - Pretty-printed output for development
  - Correlation IDs for request tracing
  - Audit logging for security events
- **Prometheus-compatible metrics** at `/metrics`:
  - HTTP request counts and latency histograms
  - Transaction counts and amounts
  - Authentication attempts
  - Database and Redis operation metrics
  - Error tracking
- **Kubernetes-ready health checks**:
  - `GET /health/live` - Liveness probe
  - `GET /health/ready` - Readiness probe (checks DB + Redis)
  - `GET /health` - Detailed component status
- **Configurable alerting system**:
  - Threshold-based alerts for errors, latency, auth failures
  - Webhook support (Slack, PagerDuty)
  - Alert cooldown to prevent flooding

#### Testing

- **Jest test suite** with 68 passing tests
- **Unit tests** for:
  - Domain logic (wallet, transactions)
  - Middleware (auth, signature, idempotency)
  - Utilities (canonical JSON)
- **E2E tests** for health endpoints
- **ES Modules support** with `--experimental-vm-modules`

#### Documentation

- **Comprehensive documentation** in `/docs`:
  - `001-PROJECT_OVERVIEW.md` - Architecture and design decisions
  - `002-GETTING_STARTED.md` - Setup and configuration guide
  - `003-API_REFERENCE.md` - Complete API documentation
  - `004-AUTHENTICATION.md` - Auth and signing details
  - `005-DATABASE_SCHEMA.md` - Data model documentation
  - `006-TESTING.md` - Testing guide
  - `007-DEPLOYMENT.md` - Deployment instructions
  - `008-MONITORING.md` - Logging, metrics, and alerting guide
- **README.md** with quick start, API overview, and feature list
- **CONTRIBUTING.md** with contribution guidelines

#### GitHub Integration

- **Issue templates**:
  - Bug report template with environment details
  - Feature request template with use cases
- **Pull request template** with checklist
- **Security policy** (`SECURITY.md`) with vulnerability reporting
- **Dependabot configuration** for automated dependency updates
- **CODEOWNERS** for automatic review requests
- **Funding configuration** for GitHub Sponsors

#### Configuration

- **Environment-based configuration** for all settings:
  - Application: `NODE_ENV`, `PORT`
  - Security: `JWT_SECRET`, `REQUEST_SIGNING_SECRET`, `SIGNATURE_TTL_MS`
  - Database: `DATABASE_URL`, `DATABASE_ADAPTER_URL`
  - Redis: `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
  - Monitoring: `LOG_LEVEL`, `ALERT_WEBHOOK_URL`
  - Alerting: `ALERT_ERROR_RATE_THRESHOLD`, `ALERT_LATENCY_THRESHOLD`, etc.
- **`.env.example`** template with all configuration options

### Technical Details

#### Dependencies

- **Runtime**:
  - Node.js 20.x with ES Modules
  - Express.js 4.22.x
  - Prisma 7.2.x with MariaDB adapter
  - ioredis 5.x
  - jsonwebtoken 9.x
  - Pino 10.x for logging
- **Development**:
  - Jest 30.x for testing
  - ESLint 9.x for linting
  - Prettier 3.x for formatting

#### Project Structure

```
wallet/
├── src/
│   ├── app.mjs              # Application entry point
│   ├── routes.mjs           # Route definitions
│   ├── domain/              # Business logic
│   ├── handlers/            # Request handlers
│   ├── middleware/          # Express middleware
│   ├── infra/               # Infrastructure (DB, Redis, logging)
│   └── utils/               # Utilities
├── prisma/                  # Database schema and migrations
├── tests/                   # Test suite
├── docs/                    # Documentation
└── .github/                 # GitHub templates and workflows
```

### Contributors

- [@zugobite](https://github.com/zugobite) - Initial development

---

## [Unreleased]

### Planned

- Rate limiting middleware
- Batch transaction support
- Transaction history endpoint
- Webhook notifications for transaction events
- Multi-currency support

---

[1.0.0]: https://github.com/zugobite/wallet/releases/tag/v1.0.0
[Unreleased]: https://github.com/zugobite/wallet/compare/v1.0.0...HEAD
