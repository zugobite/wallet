# 005 - Database Schema

## Overview

The Wallet Service uses a relational database model with five core entities following Laravel-style separated migrations:

```
User (1) ──────────── (1) Account
                            │
                            │
Account (1) ─────────── (N) Wallet
                              │
                              │
Wallet (1) ──────────── (N) Transaction
                              │
                              │
Transaction (1) ─────── (N) LedgerEntry
```

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   User                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ id           │ String   │ UUID      │ Primary Key                           │
│ email        │ String   │ UNIQUE    │ User email address                    │
│ passwordHash │ String   │           │ Bcrypt hashed password                │
│ role         │ Role     │           │ CUSTOMER or ADMIN                     │
│ createdAt    │ DateTime │           │ Creation timestamp                    │
│ updatedAt    │ DateTime │           │ Last update timestamp                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ 1:1
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  Account                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ id          │ String    │ UUID      │ Primary Key                           │
│ userId      │ String    │ UNIQUE    │ Foreign Key → User                    │
│ status      │ String    │ ACTIVE    │ Account status (ACTIVE, FROZEN)       │
│ createdAt   │ DateTime  │           │ Creation timestamp                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ 1:N
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  Wallet                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ id          │ String    │ UUID      │ Primary Key                           │
│ accountId   │ String    │ UUID      │ Foreign Key → Account                 │
│ balance     │ Int       │           │ Current balance (in cents)            │
│ currency    │ String    │           │ Currency code (USD, EUR, etc.)        │
│ version     │ Int       │ 0         │ Optimistic locking version            │
│ createdAt   │ DateTime  │           │ Creation timestamp                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ 1:N
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                Transaction                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ id          │ String    │ UUID      │ Primary Key                           │
│ walletId    │ String    │ UUID      │ Foreign Key → Wallet                  │
│ type        │ String    │           │ DEPOSIT, WITHDRAW, REVERSAL           │
│ amount      │ Int       │           │ Transaction amount (in cents)         │
│ status      │ String    │           │ PENDING, COMPLETED, REVERSED          │
│ referenceId │ String    │ UNIQUE    │ Idempotency key                       │
│ createdAt   │ DateTime  │           │ Creation timestamp                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ 1:N
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                LedgerEntry                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ id            │ String  │ UUID      │ Primary Key                           │
│ transactionId │ String  │ UUID      │ Foreign Key → Transaction             │
│ direction     │ String  │           │ DEBIT, CREDIT                         │
│ amount        │ Int     │           │ Entry amount (in cents)               │
│ balanceBefore │ Int     │           │ Balance before transaction            │
│ balanceAfter  │ Int     │           │ Balance after transaction             │
│ createdAt     │ DateTime│           │ Creation timestamp                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "mysql"
}

enum Role {
  CUSTOMER
  ADMIN
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(CUSTOMER)
  account      Account?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Account {
  id        String   @id @default(uuid())
  userId    String   @unique
  status    String   @default("ACTIVE")
  user      User     @relation(fields: [userId], references: [id])
  wallets   Wallet[]
  createdAt DateTime @default(now())
}

model Wallet {
  id        String        @id @default(uuid())
  accountId String
  balance   Int
  currency  String
  version   Int           @default(0)
  account   Account       @relation(fields: [accountId], references: [id])
  txns      Transaction[]
  createdAt DateTime      @default(now())
}

model Transaction {
  id          String        @id @default(uuid())
  walletId    String
  type        String
  amount      Int
  status      String
  referenceId String        @unique
  wallet      Wallet        @relation(fields: [walletId], references: [id])
  ledger      LedgerEntry[]
  createdAt   DateTime      @default(now())
}

model LedgerEntry {
  id            String      @id @default(uuid())
  transactionId String
  direction     String
  amount        Int
  balanceBefore Int
  balanceAfter  Int
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  createdAt     DateTime    @default(now())
}
```

---

## Field Descriptions

### User

| Field        | Type     | Description                     |
| ------------ | -------- | ------------------------------- |
| id           | UUID     | Unique identifier               |
| email        | String   | User email (unique)             |
| passwordHash | String   | Bcrypt hashed password          |
| role         | Role     | `CUSTOMER` or `ADMIN`           |
| createdAt    | DateTime | When the user was created       |
| updatedAt    | DateTime | When the user was last updated  |

### Account

| Field     | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| id        | UUID     | Unique identifier             |
| userId    | UUID     | Reference to User (unique)    |
| status    | String   | `ACTIVE` or `FROZEN`          |
| createdAt | DateTime | When the account was created  |

### Wallet

| Field     | Type     | Description                               |
| --------- | -------- | ----------------------------------------- |
| id        | UUID     | Unique identifier                         |
| accountId | UUID     | Parent account reference                  |
| balance   | Int      | Balance in smallest currency unit (cents) |
| currency  | String   | ISO 4217 currency code                    |
| version   | Int      | Optimistic locking counter                |
| createdAt | DateTime | When the wallet was created               |

### Transaction

| Field       | Type     | Description                           |
| ----------- | -------- | ------------------------------------- |
| id          | UUID     | Unique identifier                     |
| walletId    | UUID     | Target wallet reference               |
| type        | String   | `DEPOSIT`, `WITHDRAW`, `REVERSAL`     |
| amount      | Int      | Amount in smallest currency unit      |
| status      | String   | `PENDING`, `COMPLETED`, `REVERSED`    |
| referenceId | String   | Unique idempotency key                |
| createdAt   | DateTime | When the transaction was created      |

### LedgerEntry

| Field         | Type     | Description                      |
| ------------- | -------- | -------------------------------- |
| id            | UUID     | Unique identifier                |
| transactionId | UUID     | Parent transaction reference     |
| direction     | String   | `DEBIT` or `CREDIT`              |
| amount        | Int      | Entry amount                     |
| balanceBefore | Int      | Wallet balance before this entry |
| balanceAfter  | Int      | Wallet balance after this entry  |
| createdAt     | DateTime | When the entry was created       |

---

## Migrations (Laravel-Style)

Following Laravel conventions, each table has its own migration file for better organization and maintainability:

```
prisma/migrations/
├── migration_lock.toml
├── 20251230000001_create_users_table/
│   └── migration.sql
├── 20251230000002_create_accounts_table/
│   └── migration.sql
├── 20251230000003_create_wallets_table/
│   └── migration.sql
├── 20251230000004_create_transactions_table/
│   └── migration.sql
└── 20251230000005_create_ledger_entries_table/
    └── migration.sql
```

### Migration Order

| Order | Migration                     | Description                          |
| ----- | ----------------------------- | ------------------------------------ |
| 1     | `create_users_table`          | User model with auth fields          |
| 2     | `create_accounts_table`       | Account linked to User               |
| 3     | `create_wallets_table`        | Wallet linked to Account             |
| 4     | `create_transactions_table`   | Transaction linked to Wallet         |
| 5     | `create_ledger_entries_table` | LedgerEntry linked to Transaction    |

### Migration Commands

View migration history:

```bash
npx prisma migrate status
```

Create a new migration:

```bash
npx prisma migrate dev --name create_table_name
```

Apply pending migrations:

```bash
npx prisma migrate deploy
```

Reset database (⚠️ deletes all data):

```bash
npx prisma migrate reset
```

---

## Optimistic Locking

The `version` field on Wallet prevents race conditions:

```javascript
const updatedWallet = await tx.wallet.update({
  where: {
    id: walletId,
    version: wallet.version, // Only update if version matches
  },
  data: {
    balance: wallet.balance - amount,
    version: { increment: 1 }, // Increment version
  },
});
```

If two requests try to update simultaneously, one will fail because the version won't match.

---

## Audit Trail

Every transaction creates a `LedgerEntry` with:

- `balanceBefore` - What the balance was
- `balanceAfter` - What the balance became

This provides a complete audit trail for compliance and debugging.

---

## Role-Based Access Control

The `Role` enum defines user permissions:

| Role     | Description                                    |
| -------- | ---------------------------------------------- |
| CUSTOMER | Can access own wallet operations               |
| ADMIN    | Can access all users, wallets, and admin APIs  |

---

## Next Steps

- [006 - Testing](006-TESTING.md) - Database testing strategies
- [007 - Deployment](007-DEPLOYMENT.md) - Production database setup
