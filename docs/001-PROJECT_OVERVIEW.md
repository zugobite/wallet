# 001 - Project Overview

## Wallet Service

A production-grade, secure, and feature-complete digital wallet platform built with Node.js, Express, Prisma ORM, and MySQL/MariaDB. The platform provides complete user management, customer-facing wallet APIs, administrative controls, and a secure transaction engine.

## Purpose

This service provides a comprehensive foundation for managing digital wallets and transactions:

### User Management

- **Registration** - Create new user accounts with associated wallets
- **Authentication** - JWT-based secure login
- **Role-Based Access Control** - Customer and Admin roles with granular permissions

### Customer Operations

- **View Wallet** - Check wallet details and status
- **Check Balance** - Real-time balance information
- **Deposit** - Add funds to wallet
- **Withdraw** - Remove funds from wallet
- **Transaction History** - View all transactions with pagination

### Core Transaction Engine

- **Authorization** - Reserve funds for pending transactions
- **Debit** - Complete debits from a wallet
- **Credit** - Apply credits to a wallet
- **Reversal** - Reverse pending authorizations

### Administrative Controls

- **User Management** - List and monitor all users
- **Wallet Oversight** - View all wallets, freeze/unfreeze accounts
- **Transaction Monitoring** - View all transactions, perform admin reversals

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Request                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Express.js Application                            │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Health   │  │    Auth    │  │   Wallets    │  │       Admin          │  │
│  │  /health  │  │ /api/v1/   │  │  /api/v1/    │  │     /api/v1/         │  │
│  │           │  │   auth/*   │  │  wallets/*   │  │      admin/*         │  │
│  └───────────┘  └────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Transaction Routes                                │  │
│  │                   /api/v1/transactions/*                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Middleware Layer                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │ Auth Middleware │  │  RBAC Middleware │  │   Idempotency Middleware    │ │
│  │ (JWT Validate)  │  │  (Role Check)    │  │   (Duplicate Prevention)    │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────────┘ │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │ Signature (Opt) │  │  Request Logger  │  │     Health Check            │ │
│  │ (HMAC-SHA256)   │  │ (Structured Log) │  │   (Liveness/Readiness)      │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Handler Layer                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Auth Handlers         │ Wallet Handlers       │ Admin Handlers       │  │
│  │  - register.mjs        │ - getWallet.mjs       │ - listUsers.mjs      │  │
│  │  - login.mjs           │ - getBalance.mjs      │ - listWallets.mjs    │  │
│  │  - me.mjs              │ - getTransactions.mjs │ - listTransactions   │  │
│  │                        │ - deposit.mjs         │ - freezeWallet.mjs   │  │
│  │                        │ - withdraw.mjs        │ - reverseTransaction │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Transaction Handlers: authorize.mjs | debit.mjs | credit.mjs | rev   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Service Layer                                  │
│  ┌─────────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │      Auth Service           │  │        Wallet Service                 │ │
│  │  - registerUser()           │  │  - getWallet()                        │ │
│  │  - authenticateUser()       │  │  - getBalance()                       │ │
│  │  - hashPassword()           │  │  - deposit()                          │ │
│  │  - verifyPassword()         │  │  - withdraw()                         │ │
│  │  - generateToken()          │  │  - getTransactions()                  │ │
│  └─────────────────────────────┘  └───────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Transaction Service                               │ │
│  │  - authorize() | debit() | credit() | reverse() | adminReverse()       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Domain Layer                                   │
│  ┌─────────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │      Wallet Logic           │  │        Transaction Logic              │ │
│  │  - assertWalletActive()     │  │  - assertTransactionPending()         │ │
│  │  - canDebit()               │  │  - assertCanReverse()                 │ │
│  │  - canCredit()              │  │  - DomainError class                  │ │
│  │  - DomainError class        │  │                                       │ │
│  └─────────────────────────────┘  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Repository Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  User Repo      │  │  Account Repo   │  │     Wallet Repo             │  │
│  │  - findById     │  │  - findById     │  │  - findById                 │  │
│  │  - findByEmail  │  │  - freeze       │  │  - findByAccountId          │  │
│  │  - createUser   │  │  - unfreeze     │  │  - updateBalance            │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Transaction Repo               │  │     Ledger Repo                  │  │
│  │  - findByReference              │  │  - createLedgerEntry             │  │
│  │  - createTransaction            │  │  - findByTransactionId           │  │
│  │  - updateStatus                 │  │                                  │  │
│  └─────────────────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Infrastructure Layer                              │
│  ┌─────────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │      Prisma ORM             │  │            Redis                      │ │
│  │  - MySQL/MariaDB adapter    │  │  - Replay protection                  │ │
│  │  - Transaction support      │  │  - Nonce storage                      │ │
│  │  - Optimistic locking       │  │  - TTL-based expiration               │ │
│  └─────────────────────────────┘  └───────────────────────────────────────┘ │
│  ┌─────────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │      Logger                 │  │          Metrics                      │ │
│  │  - Structured logging       │  │  - Prometheus format                  │ │
│  │  - Request correlation      │  │  - Transaction metrics                │ │
│  └─────────────────────────────┘  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Database Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    User     │  │   Account   │  │   Wallet    │  │    Transaction      │ │
│  │  - email    │  │  - userId   │  │  - balance  │  │  - type/status      │ │
│  │  - password │  │  - status   │  │  - currency │  │  - amount           │ │
│  │  - role     │  │             │  │  - version  │  │  - referenceId      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         LedgerEntry                                    │ │
│  │        - direction | amount | balanceBefore | balanceAfter             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Authentication & Authorization

| Feature                      | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| **User Registration**        | Create accounts with email/password             |
| **JWT Authentication**       | Secure token-based authentication               |
| **Password Hashing**         | bcrypt with salt for secure password storage    |
| **Role-Based Access (RBAC)** | Customer and Admin roles with permission matrix |
| **Token Expiration**         | Configurable JWT expiration for security        |

### Customer Features

| Feature                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| **View Wallet**         | Get wallet details including balance and currency    |
| **Check Balance**       | Real-time balance with available balance calculation |
| **Deposit Funds**       | Add funds with idempotent reference tracking         |
| **Withdraw Funds**      | Remove funds with balance validation                 |
| **Transaction History** | Paginated history with type/status filtering         |
| **Wallet Ownership**    | Customers can only access their own wallets          |

### Admin Features

| Feature                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| **List Users**          | View all users with pagination and role filtering    |
| **List Wallets**        | View all wallets with balance/currency filtering     |
| **List Transactions**   | View all transactions with type/status filtering     |
| **Freeze Wallet**       | Suspend wallet operations with reason logging        |
| **Unfreeze Wallet**     | Restore wallet operations                            |
| **Reverse Transaction** | Admin reversal of completed transactions with reason |

### Transaction Engine

| Feature                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| **Two-Phase Debit**    | Authorize → Debit/Reverse pattern for safe fund holds |
| **Direct Credit**      | Immediate credit application                          |
| **Idempotency**        | Prevents duplicate transaction processing             |
| **Optimistic Locking** | Prevents race conditions with version control         |
| **Audit Trail**        | Complete ledger entries with balance before/after     |

### Security

| Feature                  | Description                              |
| ------------------------ | ---------------------------------------- |
| **HMAC Signatures**      | Optional request authenticity validation |
| **Replay Protection**    | Nonce-based prevention with Redis TTL    |
| **Frozen Account Check** | Transactions blocked on frozen accounts  |
| **Input Validation**     | Zod schema validation on all inputs      |

### Infrastructure

| Feature                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| **Structured Logging** | JSON logging with correlation IDs              |
| **Prometheus Metrics** | Transaction and performance metrics            |
| **Health Checks**      | Liveness and readiness probes for Kubernetes   |
| **Serverless Ready**   | Compatible with AWS Lambda via serverless-http |

---

## API Endpoints Summary

### Public (No Auth Required)

| Method | Endpoint        | Description     |
| ------ | --------------- | --------------- |
| GET    | `/health`       | Health check    |
| GET    | `/health/live`  | Liveness probe  |
| GET    | `/health/ready` | Readiness probe |
| GET    | `/api/v1`       | API information |

### Authentication

| Method | Endpoint                | Description       |
| ------ | ----------------------- | ----------------- |
| POST   | `/api/v1/auth/register` | Register new user |
| POST   | `/api/v1/auth/login`    | Login, get token  |
| GET    | `/api/v1/auth/me`       | Get current user  |

### Customer Wallets (Authenticated)

| Method | Endpoint                           | Description             |
| ------ | ---------------------------------- | ----------------------- |
| GET    | `/api/v1/wallets/:id`              | Get wallet details      |
| GET    | `/api/v1/wallets/:id/balance`      | Get wallet balance      |
| GET    | `/api/v1/wallets/:id/transactions` | Get transaction history |
| POST   | `/api/v1/wallets/:id/deposit`      | Deposit funds           |
| POST   | `/api/v1/wallets/:id/withdraw`     | Withdraw funds          |

### Transactions (Authenticated)

| Method | Endpoint                         | Description                  |
| ------ | -------------------------------- | ---------------------------- |
| POST   | `/api/v1/transactions/authorize` | Create pending authorization |
| POST   | `/api/v1/transactions/debit`     | Complete debit               |
| POST   | `/api/v1/transactions/credit`    | Direct credit                |
| POST   | `/api/v1/transactions/reverse`   | Reverse authorization        |

### Admin (ADMIN Role Required)

| Method | Endpoint                                 | Description           |
| ------ | ---------------------------------------- | --------------------- |
| GET    | `/api/v1/admin/users`                    | List all users        |
| GET    | `/api/v1/admin/wallets`                  | List all wallets      |
| GET    | `/api/v1/admin/transactions`             | List all transactions |
| POST   | `/api/v1/admin/wallets/:id/freeze`       | Freeze wallet         |
| POST   | `/api/v1/admin/wallets/:id/unfreeze`     | Unfreeze wallet       |
| POST   | `/api/v1/admin/transactions/:id/reverse` | Admin reverse         |

---

## Technology Stack

| Category   | Technology      | Version | Purpose                          |
| ---------- | --------------- | ------- | -------------------------------- |
| Runtime    | Node.js         | v20+    | JavaScript runtime               |
| Framework  | Express.js      | 4.x     | Web framework                    |
| ORM        | Prisma          | 7.x     | Database access                  |
| Database   | MySQL / MariaDB | 8.x     | Data persistence                 |
| Cache      | Redis           | 7.x     | Replay protection, nonce storage |
| Auth       | jsonwebtoken    | 9.x     | JWT token generation             |
| Auth       | bcryptjs        | 3.x     | Password hashing                 |
| Validation | Zod             | 4.x     | Schema validation                |
| Testing    | Jest            | 30.x    | Test framework                   |
| Testing    | Supertest       | 7.x     | HTTP assertions                  |

---

## Project Structure

```
wallet/
├── docs/                          # Documentation
│   ├── 001-PROJECT_OVERVIEW.md    # This file
│   ├── 002-GETTING_STARTED.md     # Setup and quick start
│   ├── 003-API_REFERENCE.md       # Complete API with cURL examples
│   ├── 004-AUTHENTICATION.md      # Auth, RBAC, and signing
│   ├── 005-DATABASE_SCHEMA.md     # Data model reference
│   ├── 006-TESTING.md             # Testing guide
│   ├── 007-DEPLOYMENT.md          # Deployment instructions
│   ├── 008-MONITORING.md          # Logging and metrics
│   └── 009-SCALING.md             # Scaling strategies
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # Migration history
├── src/
│   ├── app.mjs                    # Application entry point
│   ├── routes.mjs                 # Route definitions
│   ├── domain/                    # Business logic
│   │   ├── wallet.mjs             # Wallet domain functions
│   │   └── transactions.mjs       # Transaction domain functions
│   ├── handlers/                  # Request handlers
│   │   ├── auth/                  # Auth handlers
│   │   │   ├── register.mjs
│   │   │   ├── login.mjs
│   │   │   └── me.mjs
│   │   ├── wallets/               # Wallet handlers
│   │   │   ├── getWallet.mjs
│   │   │   ├── getBalance.mjs
│   │   │   ├── getTransactions.mjs
│   │   │   ├── deposit.mjs
│   │   │   └── withdraw.mjs
│   │   ├── admin/                 # Admin handlers
│   │   │   ├── listUsers.mjs
│   │   │   ├── listWallets.mjs
│   │   │   ├── listTransactions.mjs
│   │   │   ├── freezeWallet.mjs
│   │   │   └── reverseTransaction.mjs
│   │   ├── authorize.mjs          # Transaction handlers
│   │   ├── debit.mjs
│   │   ├── credit.mjs
│   │   └── reverse.mjs
│   ├── services/                  # Business logic services
│   │   ├── auth.service.mjs
│   │   ├── wallet.service.mjs
│   │   └── transaction.service.mjs
│   ├── middleware/                # Express middleware
│   │   ├── auth.mjs               # JWT authentication
│   │   ├── rbac.mjs               # Role-based access control
│   │   ├── idempotency.mjs        # Duplicate prevention
│   │   ├── signature.mjs          # HMAC validation
│   │   ├── requestLogger.mjs      # Request logging
│   │   └── healthCheck.mjs        # Health probes
│   ├── infra/                     # Infrastructure
│   │   ├── prisma.mjs             # Prisma client
│   │   ├── redis.mjs              # Redis client
│   │   ├── logger.mjs             # Structured logging
│   │   ├── metrics.mjs            # Prometheus metrics
│   │   ├── alerting.mjs           # Alert system
│   │   └── repositories/          # Data access layer
│   │       ├── user.repo.mjs
│   │       ├── account.repo.mjs
│   │       ├── wallet.repo.mjs
│   │       ├── transactions.repo.mjs
│   │       ├── ledger.repo.mjs
│   │       └── index.mjs
│   ├── routes/                    # Route modules
│   │   ├── auth.routes.mjs
│   │   ├── wallet.routes.mjs
│   │   └── admin.routes.mjs
│   ├── utils/                     # Utilities
│   │   └── canonicalJson.mjs
│   └── generated/                 # Prisma client (generated)
├── tests/                         # Test suite (201 tests)
│   ├── setup.js                   # Test configuration
│   ├── unit/                      # Unit tests
│   │   ├── domain/
│   │   ├── middleware/
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── utils/
│   └── e2e/                       # End-to-end tests
├── .env.example                   # Environment template
├── package.json
├── jest.config.mjs
├── ANALYSIS.md                    # Gap analysis and implementation status
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## User Flows

### Customer Journey

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Register   │────▶│    Login    │────▶│  View Wallet │
└──────────────┘     └─────────────┘     └──────┬───────┘
                                                │
         ┌──────────────────────────────────────┤
         ▼                                      ▼
┌──────────────┐                        ┌──────────────┐
│   Deposit    │                        │   Withdraw   │
└──────┬───────┘                        └──────┬───────┘
       │                                       │
       └───────────────────┬───────────────────┘
                           ▼
                  ┌──────────────────┐
                  │ View Transactions│
                  └──────────────────┘
```

### Admin Journey

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│    Login     │────▶│  Monitor Users  │────▶│  Monitor Wallets │
└──────────────┘     └─────────────────┘     └────────┬─────────┘
                                                      │
         ┌────────────────────────────────────────────┤
         ▼                                            ▼
┌──────────────────┐                        ┌─────────────────────┐
│ Freeze/Unfreeze  │                        │  Reverse Transaction│
│     Wallet       │                        │    (with reason)    │
└──────────────────┘                        └─────────────────────┘
```

---

## Quick Start Example

```bash
# 1. Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'

# 2. Save token and wallet ID from response
export TOKEN="your-jwt-token"
export WALLET_ID="your-wallet-id"

# 3. Deposit
curl -X POST "http://localhost:3000/api/v1/wallets/$WALLET_ID/deposit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "referenceId": "deposit-001"}'

# 4. Check balance
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/balance" \
  -H "Authorization: Bearer $TOKEN"

# 5. Withdraw
curl -X POST "http://localhost:3000/api/v1/wallets/$WALLET_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 2500, "referenceId": "withdraw-001"}'
```

---

## Test Coverage

The project includes 201 unit tests covering:

- **Domain Logic** - Wallet and transaction business rules
- **Middleware** - Auth, RBAC, idempotency, signature verification
- **Handlers** - Auth, wallet, admin, transaction handlers
- **Services** - Auth, wallet, transaction services
- **Repositories** - Data access patterns
- **Utilities** - Canonical JSON, helpers
- **E2E** - Health endpoints, API flows

```bash
npm test              # Run all 201 tests
npm run test:unit     # Run unit tests only
npm run test:e2e      # Run end-to-end tests
```

---

## Next Steps

- [002 - Getting Started](002-GETTING_STARTED.md) - Setup, installation, and quick start tutorial
- [003 - API Reference](003-API_REFERENCE.md) - Complete API documentation with cURL examples
- [004 - Authentication](004-AUTHENTICATION.md) - Security, RBAC, and request signing details
- [005 - Database Schema](005-DATABASE_SCHEMA.md) - Data model and relationships
- [006 - Testing](006-TESTING.md) - Testing guide and patterns
