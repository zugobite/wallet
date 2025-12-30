# 005 - Database Schema

## Overview

The Wallet Service uses a relational database model with four core entities:

```
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
│                                  Account                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ id          │ String    │ UUID      │ Primary Key                           │
│ userId      │ String    │           │ External user identifier              │
│ status      │ String    │           │ Account status (active, frozen, etc.) │
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
│ type        │ String    │           │ authorize, debit, credit              │
│ amount      │ Int       │           │ Transaction amount (in cents)         │
│ status      │ String    │           │ pending, completed, reversed          │
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
│ direction     │ String  │           │ debit, credit                         │
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

model Account {
  id        String   @id @default(uuid())
  userId    String
  status    String
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

### Account

| Field     | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| id        | UUID     | Unique identifier                      |
| userId    | String   | External user ID from your auth system |
| status    | String   | `active`, `frozen`, `closed`           |
| createdAt | DateTime | When the account was created           |

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

| Field       | Type     | Description                        |
| ----------- | -------- | ---------------------------------- |
| id          | UUID     | Unique identifier                  |
| walletId    | UUID     | Target wallet reference            |
| type        | String   | `authorize`, `debit`, `credit`     |
| amount      | Int      | Amount in smallest currency unit   |
| status      | String   | `pending`, `completed`, `reversed` |
| referenceId | String   | Unique idempotency key             |
| createdAt   | DateTime | When the transaction was created   |

### LedgerEntry

| Field         | Type     | Description                      |
| ------------- | -------- | -------------------------------- |
| id            | UUID     | Unique identifier                |
| transactionId | UUID     | Parent transaction reference     |
| direction     | String   | `debit` or `credit`              |
| amount        | Int      | Entry amount                     |
| balanceBefore | Int      | Wallet balance before this entry |
| balanceAfter  | Int      | Wallet balance after this entry  |
| createdAt     | DateTime | When the entry was created       |

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

## Migrations

View migration history:

```bash
npx prisma migrate status
```

Create a new migration:

```bash
npx prisma migrate dev --name description_of_change
```

Reset database (⚠️ deletes all data):

```bash
npx prisma migrate reset
```

---

## Next Steps

- [006 - Testing](006-TESTING.md) - Database testing strategies
- [007 - Deployment](007-DEPLOYMENT.md) - Production database setup
