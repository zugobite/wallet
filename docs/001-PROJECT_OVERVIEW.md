# 001 - Project Overview

## Wallet Service

A production-grade, secure, and idempotent digital wallet API built with Node.js, Express, Prisma ORM, and MySQL/MariaDB.

## Purpose

This service provides a robust foundation for managing digital wallet transactions including:

- **Authorization** - Reserve funds for pending transactions
- **Debit** - Withdraw funds from a wallet
- **Credit** - Deposit funds to a wallet
- **Reversal** - Reverse completed transactions

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Request                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Express.js Application                            │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────────────┐ │
│  │   Health    │  │   API Info       │  │   Transaction Routes            │ │
│  │  /health    │  │   /api/v1        │  │   /api/v1/transactions/*        │ │
│  └─────────────┘  └──────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Middleware Layer                               │
│  ┌───────────────────┐  ┌────────────────────┐  ┌────────────────────────┐  │
│  │  Auth Middleware  │  │ Idempotency Check  │  │  Signature Validation  │  │
│  │  (JWT Validation) │  │  (Duplicate Guard) │  │  (HMAC-SHA256)         │  │
│  └───────────────────┘  └────────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Handler Layer                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Authorize  │  │    Debit    │  │   Credit    │  │      Reverse        │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Domain Layer                                   │
│  ┌─────────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │      Wallet Logic           │  │        Transaction Logic              │ │
│  │  - Balance validation       │  │  - Status management                  │ │
│  │  - Account status checks    │  │  - Pending state validation           │ │
│  └─────────────────────────────┘  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Infrastructure Layer                              │
│  ┌─────────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │      Prisma ORM             │  │            Redis                      │ │
│  │  - MySQL/MariaDB adapter    │  │  - Replay protection                  │ │
│  │  - Transaction support      │  │  - Nonce storage                      │ │
│  └─────────────────────────────┘  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Database Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Account   │  │   Wallet    │  │ Transaction │  │    LedgerEntry      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

| Feature                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| **JWT Authentication** | Secure token-based authentication                 |
| **Idempotency**        | Prevents duplicate transaction processing         |
| **HMAC Signatures**    | Request authenticity validation                   |
| **Optimistic Locking** | Prevents race conditions with version control     |
| **Audit Trail**        | Complete ledger entries with balance before/after |
| **Serverless Ready**   | Compatible with AWS Lambda via serverless-http    |

## Technology Stack

- **Runtime**: Node.js v20+
- **Framework**: Express.js 4.x
- **ORM**: Prisma 7.x
- **Database**: MySQL 8.x / MariaDB
- **Cache**: Redis (for replay protection)
- **Testing**: Jest + Supertest

## Project Structure

```
wallet/
├── docs/                          # Documentation
│   ├── 001-PROJECT_OVERVIEW.md
│   ├── 002-GETTING_STARTED.md
│   ├── 003-API_REFERENCE.md
│   ├── 004-AUTHENTICATION.md
│   ├── 005-DATABASE_SCHEMA.md
│   ├── 006-TESTING.md
│   └── 007-DEPLOYMENT.md
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # Migration files
├── src/
│   ├── app.mjs                    # Application entry point
│   ├── routes.mjs                 # Route definitions
│   ├── domain/                    # Business logic
│   ├── handlers/                  # Request handlers
│   ├── infra/                     # Infrastructure (DB, Redis)
│   ├── middleware/                # Express middleware
│   └── generated/                 # Prisma client (generated)
├── tests/
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
├── .env.example                   # Environment template
├── package.json
└── README.md
```

## Next Steps

- [002 - Getting Started](002-GETTING_STARTED.md) - Setup and installation
- [003 - API Reference](003-API_REFERENCE.md) - Complete API documentation
- [004 - Authentication](004-AUTHENTICATION.md) - Security implementation details
