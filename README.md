# Wallet Transaction API

A secure, production-ready wallet transaction API with user authentication, two-phase debit authorization, HMAC request signing, and comprehensive admin controls.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748.svg)](https://prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1.svg)](https://mysql.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **User Registration & Authentication** - Complete auth flow with JWT tokens
- **Role-Based Access Control (RBAC)** - Customer and Admin roles
- **Customer Wallet APIs** - Deposit, withdraw, view balance and transactions
- **Admin Controls** - Freeze wallets, reverse transactions, platform oversight
- **Two-Phase Debit Authorization** - Authorize → Debit/Reverse pattern for safe fund holds
- **HMAC-SHA256 Request Signing** - Cryptographic request integrity verification
- **Replay Protection** - Nonce-based protection against duplicate requests
- **Idempotent Operations** - Safe retry handling with referenceId tracking
- **Full Audit Trail** - Complete ledger with balance snapshots
- **Serverless Ready** - AWS Lambda compatible via serverless-http

## Table of Contents

- [Quick Start](#-quick-start)
- [API Endpoints](#-api-endpoints)
- [cURL Examples](#-curl-examples)
- [Authentication](#-authentication)
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

### Public Endpoints

| Method | Endpoint       | Description                 |
| ------ | -------------- | --------------------------- |
| `GET`  | `/health`      | Health check (no auth)      |
| `GET`  | `/health/live` | Liveness probe (Kubernetes) |
| `GET`  | `/health/ready`| Readiness probe (Kubernetes)|
| `GET`  | `/api/v1`      | API information (no auth)   |

### Authentication Endpoints

| Method | Endpoint               | Description            |
| ------ | ---------------------- | ---------------------- |
| `POST` | `/api/v1/auth/register`| Register new user      |
| `POST` | `/api/v1/auth/login`   | Login and get token    |
| `GET`  | `/api/v1/auth/me`      | Get current user       |

### Customer Wallet Endpoints

| Method | Endpoint                           | Description              |
| ------ | ---------------------------------- | ------------------------ |
| `GET`  | `/api/v1/wallets/:id`              | Get wallet details       |
| `GET`  | `/api/v1/wallets/:id/balance`      | Get wallet balance       |
| `GET`  | `/api/v1/wallets/:id/transactions` | Get transaction history  |
| `POST` | `/api/v1/wallets/:id/deposit`      | Deposit funds            |
| `POST` | `/api/v1/wallets/:id/withdraw`     | Withdraw funds           |

### Transaction Endpoints

| Method | Endpoint                         | Description                   |
| ------ | -------------------------------- | ----------------------------- |
| `POST` | `/api/v1/transactions/authorize` | Create pending authorization  |
| `POST` | `/api/v1/transactions/debit`     | Complete debit transaction    |
| `POST` | `/api/v1/transactions/credit`    | Direct credit to wallet       |
| `POST` | `/api/v1/transactions/reverse`   | Reverse pending authorization |

### Admin Endpoints (ADMIN role required)

| Method | Endpoint                               | Description              |
| ------ | -------------------------------------- | ------------------------ |
| `GET`  | `/api/v1/admin/users`                  | List all users           |
| `GET`  | `/api/v1/admin/wallets`                | List all wallets         |
| `GET`  | `/api/v1/admin/transactions`           | List all transactions    |
| `POST` | `/api/v1/admin/wallets/:id/freeze`     | Freeze a wallet          |
| `POST` | `/api/v1/admin/wallets/:id/unfreeze`   | Unfreeze a wallet        |
| `POST` | `/api/v1/admin/transactions/:id/reverse` | Admin reverse transaction |

## cURL Examples

### Register a New Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "SecurePassword123!"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "SecurePassword123!"
  }'
```

### Check Wallet Balance

```bash
curl -X GET "http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/balance" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Deposit Funds

```bash
curl -X POST "http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/deposit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 10000,
    "referenceId": "deposit-001"
  }'
```

### Withdraw Funds

```bash
curl -X POST "http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/withdraw" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 2500,
    "referenceId": "withdraw-001"
  }'
```

### View Transaction History

```bash
curl -X GET "http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/transactions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Complete Customer Flow

```bash
# 1. Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'

# Save from response:
export TOKEN="your-jwt-token"
export WALLET_ID="your-wallet-id"

# 2. Deposit funds
curl -X POST "http://localhost:3000/api/v1/wallets/$WALLET_ID/deposit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 10000, "referenceId": "deposit-001"}'

# 3. Check balance
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/balance" \
  -H "Authorization: Bearer $TOKEN"

# 4. Withdraw
curl -X POST "http://localhost:3000/api/v1/wallets/$WALLET_ID/withdraw" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 2500, "referenceId": "withdraw-001"}'

# 5. View history
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/transactions" \
  -H "Authorization: Bearer $TOKEN"
```

### Admin Operations

```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "AdminPass123!"}'

export ADMIN_TOKEN="admin-jwt-token"

# List all users
curl -X GET "http://localhost:3000/api/v1/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# List all wallets
curl -X GET "http://localhost:3000/api/v1/admin/wallets" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Freeze a suspicious wallet
curl -X POST "http://localhost:3000/api/v1/admin/wallets/WALLET_ID/freeze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Suspicious activity"}'

# Reverse a fraudulent transaction
curl -X POST "http://localhost:3000/api/v1/admin/transactions/TXN_ID/reverse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Customer refund"}'
```

## Authentication

### JWT Token

The API uses JWT (JSON Web Token) authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### User Roles

| Role     | Description            | Access                               |
| -------- | ---------------------- | ------------------------------------ |
| CUSTOMER | Regular user           | Own wallets and transactions only    |
| ADMIN    | Platform administrator | All users, wallets, and transactions |

### Request Signing (Optional)

For high-security environments, requests can be signed using HMAC-SHA256. See [Authentication docs](docs/004-AUTHENTICATION.md) for details.

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

### Direct Operations

- **Deposit** - Credits are applied immediately
- **Withdraw** - Debits are applied immediately

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
│   │   ├── auth/            # Register, login, me
│   │   ├── wallets/         # Wallet operations
│   │   ├── admin/           # Admin operations
│   │   ├── authorize.mjs
│   │   ├── debit.mjs
│   │   ├── credit.mjs
│   │   └── reverse.mjs
│   ├── services/            # Service layer
│   │   ├── auth.service.mjs
│   │   ├── wallet.service.mjs
│   │   └── transaction.service.mjs
│   ├── middleware/          # Express middleware
│   │   ├── auth.mjs
│   │   ├── rbac.mjs         # Role-based access control
│   │   ├── idempotency.mjs
│   │   ├── signature.mjs
│   │   ├── requestLogger.mjs
│   │   └── healthCheck.mjs
│   ├── infra/               # Infrastructure
│   │   ├── prisma.mjs
│   │   ├── redis.mjs
│   │   ├── logger.mjs
│   │   ├── metrics.mjs
│   │   ├── alerting.mjs
│   │   └── repositories/
│   └── utils/
│       └── canonicalJson.mjs
├── prisma/
│   └── schema.prisma        # Database schema
├── tests/                   # Test suite (201 tests)
├── docs/                    # Documentation
└── package.json
```

## Documentation

Comprehensive documentation is available in the `/docs` directory:

| Document                                                | Description                          |
| ------------------------------------------------------- | ------------------------------------ |
| [001-PROJECT_OVERVIEW.md](docs/001-PROJECT_OVERVIEW.md) | Architecture and design decisions    |
| [002-GETTING_STARTED.md](docs/002-GETTING_STARTED.md)   | Setup, configuration, and quick start|
| [003-API_REFERENCE.md](docs/003-API_REFERENCE.md)       | Complete API docs with cURL examples |
| [004-AUTHENTICATION.md](docs/004-AUTHENTICATION.md)     | Auth, RBAC, and signing details      |
| [005-DATABASE_SCHEMA.md](docs/005-DATABASE_SCHEMA.md)   | Data model documentation             |
| [006-TESTING.md](docs/006-TESTING.md)                   | Testing guide                        |
| [007-DEPLOYMENT.md](docs/007-DEPLOYMENT.md)             | Deployment instructions              |
| [008-MONITORING.md](docs/008-MONITORING.md)             | Logging, metrics & alerting          |
| [009-SCALING.md](docs/009-SCALING.md)                   | Scaling to 100M+ transactions        |

## Testing

```bash
# Run all tests (201 tests)
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

- **Unit Tests** - Domain logic, middleware, services, repositories
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
