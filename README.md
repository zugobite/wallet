# Wallet Transaction API

A secure, production-ready wallet transaction API with two-phase debit authorization, HMAC request signing, and comprehensive replay protection.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748.svg)](https://prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1.svg)](https://mysql.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **Two-Phase Debit Authorization** - Authorize → Debit/Reverse pattern for safe fund holds
- **HMAC-SHA256 Request Signing** - Cryptographic request integrity verification
- **Replay Protection** - Nonce-based protection against duplicate requests
- **JWT Authentication** - Secure token-based authentication
- **Idempotent Operations** - Safe retry handling with referenceId tracking
- **Full Audit Trail** - Complete ledger with balance snapshots
- **Serverless Ready** - AWS Lambda compatible via serverless-http

## Table of Contents

- [Quick Start](#-quick-start)
- [API Endpoints](#-api-endpoints)
- [Authentication](#-authentication)
- [Request Signing](#-request-signing)
- [Transaction Flow](#-transaction-flow)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)
- [Testing](#-testing)
- [Contributing](#-contributing)
- [License](#-license)

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- MySQL 8.x or MariaDB 10.x
- Redis 7.x

### Installation

```bash
# Clone the repository
git clone https://github.com/zugobite/wallet.git
cd wallet

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start the server
npm run dev
```

The server will start at `http://localhost:3000`.

### Health Check

```bash
curl http://localhost:3000/health
```

## API Endpoints

| Method | Endpoint                         | Description                        |
| ------ | -------------------------------- | ---------------------------------- |
| `GET`  | `/health`                        | Detailed health check (no auth)    |
| `GET`  | `/health/live`                   | Liveness probe (Kubernetes)        |
| `GET`  | `/health/ready`                  | Readiness probe (Kubernetes)       |
| `GET`  | `/metrics`                       | Prometheus metrics (no auth)       |
| `GET`  | `/api/v1`                        | API information (no auth)          |
| `POST` | `/api/v1/transactions/authorize` | Create pending debit authorization |
| `POST` | `/api/v1/transactions/debit`     | Complete authorized transaction    |
| `POST` | `/api/v1/transactions/credit`    | Direct credit to wallet            |
| `POST` | `/api/v1/transactions/reverse`   | Reverse pending authorization      |

### Example Request

```bash
curl -X POST http://localhost:3000/api/v1/transactions/authorize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "X-Signature: <hmac_signature>" \
  -H "X-Signature-Version: v1" \
  -H "X-Timestamp: <epoch_ms>" \
  -H "X-Nonce: <unique_uuid>" \
  -d '{
    "walletId": "wallet-uuid",
    "amount": 1000,
    "referenceId": "order-12345"
  }'
```

### Response Format

All endpoints return consistent JSON responses:

```json
{
  "status": 201,
  "code": "CREATED",
  "data": {
    "transactionId": "txn-uuid",
    "status": "PENDING",
    "amount": 1000
  }
}
```

## Authentication

The API uses JWT (JSON Web Token) authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

The JWT payload must include:

- `sub` - User ID that maps to an account

## Request Signing

All transaction endpoints require HMAC-SHA256 request signing for integrity verification.

### Required Headers

| Header                | Description                      |
| --------------------- | -------------------------------- |
| `X-Signature`         | HMAC-SHA256 signature (hex)      |
| `X-Signature-Version` | Always `v1`                      |
| `X-Timestamp`         | Request timestamp (epoch ms)     |
| `X-Nonce`             | Unique request identifier (UUID) |

### Signature Generation

```javascript
const crypto = require("crypto");

const payload = [
  "POST", // HTTP method
  "/api/v1/transactions/authorize", // URL path
  timestamp, // X-Timestamp value
  nonce, // X-Nonce value
  JSON.stringify(sortedBody), // Canonicalized request body
].join("|");

const signature = crypto
  .createHmac("sha256", REQUEST_SIGNING_SECRET)
  .update(payload)
  .digest("hex");
```

## Transaction Flow

### Two-Phase Debit

```
┌─────────┐     ┌───────────┐     ┌─────────┐
│ Client  │────▶│ Authorize │────▶│ PENDING │
└─────────┘     └───────────┘     └────┬────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
              ┌───────────┐                         ┌───────────┐
              │   Debit   │                         │  Reverse  │
              └─────┬─────┘                         └─────┬─────┘
                    ▼                                     ▼
              ┌───────────┐                         ┌───────────┐
              │ COMPLETED │                         │ REVERSED  │
              └───────────┘                         └───────────┘
```

1. **Authorize** - Create a pending hold on funds
2. **Debit** - Complete the transaction and deduct funds
3. **Reverse** - Cancel the authorization and release hold

### Direct Credit

Credits are applied immediately without the two-phase flow.

## Project Structure

```
wallet/
├── src/
│   ├── app.mjs              # Application entry point
│   ├── routes.mjs           # Route definitions
│   ├── domain/              # Business logic
│   │   ├── wallet.mjs
│   │   └── transactions.mjs
│   ├── handlers/            # Request handlers
│   │   ├── authorize.mjs
│   │   ├── debit.mjs
│   │   ├── credit.mjs
│   │   └── reverse.mjs
│   ├── middleware/          # Express middleware
│   │   ├── auth.mjs
│   │   ├── idempotency.mjs
│   │   ├── signature.mjs
│   │   ├── requestLogger.mjs  # Request logging
│   │   └── healthCheck.mjs    # Health probes
│   ├── infra/               # Infrastructure
│   │   ├── prisma.mjs
│   │   ├── redis.mjs
│   │   ├── logger.mjs         # Structured logging
│   │   ├── metrics.mjs        # Prometheus metrics
│   │   ├── alerting.mjs       # Alert system
│   │   └── repositories/
│   └── utils/
│       └── canonicalJson.mjs
├── prisma/
│   └── schema.prisma        # Database schema
├── tests/                   # Test suite
├── docs/                    # Documentation
└── package.json
```

## Documentation

Comprehensive documentation is available in the `/docs` directory:

| Document                                                | Description                       |
| ------------------------------------------------------- | --------------------------------- |
| [001-PROJECT_OVERVIEW.md](docs/001-PROJECT_OVERVIEW.md) | Architecture and design decisions |
| [002-GETTING_STARTED.md](docs/002-GETTING_STARTED.md)   | Setup and configuration guide     |
| [003-API_REFERENCE.md](docs/003-API_REFERENCE.md)       | Complete API documentation        |
| [004-AUTHENTICATION.md](docs/004-AUTHENTICATION.md)     | Auth and signing details          |
| [005-DATABASE_SCHEMA.md](docs/005-DATABASE_SCHEMA.md)   | Data model documentation          |
| [006-TESTING.md](docs/006-TESTING.md)                   | Testing guide                     |
| [007-DEPLOYMENT.md](docs/007-DEPLOYMENT.md)             | Deployment instructions           |
| [008-MONITORING.md](docs/008-MONITORING.md)             | Logging, metrics & alerting       |
| [009-SCALING.md](docs/009-SCALING.md)                   | Scaling to 100M+ transactions     |

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure

- **Unit Tests** - Domain logic, middleware, utilities
- **E2E Tests** - Health endpoint, API flow verification

## Development

```bash
# Start development server
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

## Environment Variables

| Variable                 | Description                     | Required |
| ------------------------ | ------------------------------- | -------- |
| `DATABASE_URL`           | MySQL connection string         | Yes      |
| `DATABASE_ADAPTER_URL`   | MariaDB adapter URL             | Yes      |
| `REDIS_URL`              | Redis connection string         | Yes      |
| `JWT_SECRET`             | JWT signing secret (64+ bytes)  | Yes      |
| `REQUEST_SIGNING_SECRET` | HMAC signing secret (64+ bytes) | Yes      |
| `SIGNATURE_TTL_MS`       | Request validity window (ms)    | Yes      |
| `PORT`                   | Server port (default: 3000)     | No       |

See [.env.example](.env.example) for a complete template.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

## Disclaimer

This project is created **purely for educational and portfolio demonstration purposes** to showcase my knowledge of financial transaction systems and software architecture.

**Important notices:**

- It implements **industry-standard patterns** documented in publicly available resources including:
  - Stripe's API design guidelines
  - Martin Fowler's enterprise architecture patterns
  - PCI-DSS compliance frameworks
  - RFC standards (JWT, HMAC, etc.)
- This is **not intended for production use** without proper security audits, compliance reviews, and regulatory approvals

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
