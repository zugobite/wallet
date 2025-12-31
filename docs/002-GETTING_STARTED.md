# 002 - Getting Started

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Purpose                       |
| ----------- | ------- | ----------------------------- |
| Node.js     | v20+    | JavaScript runtime            |
| npm         | v10+    | Package manager               |
| MySQL       | v8+     | Database server               |
| Redis       | v7+     | Caching and replay protection |

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/zugobite/wallet.git
cd wallet
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Update the following values in `.env`:

```dotenv
NODE_ENV=development

# Security - Generate these using the command above
JWT_SECRET=<your-64-byte-hex-secret>
REQUEST_SIGNING_SECRET=<your-64-byte-hex-secret>
SIGNATURE_TTL_MS=300000

# Database - Update with your MySQL credentials
DATABASE_URL="mysql://root:password@localhost:3306/wallet"
DATABASE_ADAPTER_URL="mariadb://root:password@localhost:3306/wallet"

# Redis
REDIS_URL="redis://localhost:6379"
```

### 4. Setup Database

Create the database:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS wallet;"
```

Run migrations:

```bash
npm run prisma:migrate
```

Generate Prisma client:

```bash
npm run prisma:generate
```

### 5. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`.

## Verify Installation

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "message": "Service is healthy"
  }
}
```

### API Info

```bash
curl http://localhost:3000/api/v1
```

Expected response:

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "version": "1.0.0",
    "endpoints": [...]
  }
}
```

---

## Quick Start: Your First Transaction

Follow this step-by-step guide to register an account, deposit funds, and make transactions.

### Step 1: Register a New Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "SecurePassword123!",
    "currency": "USD"
  }'
```

**Response:**

```json
{
  "status": 201,
  "code": "CREATED",
  "data": {
    "user": {
      "id": "abc123-user-uuid",
      "email": "demo@example.com",
      "role": "CUSTOMER"
    },
    "account": {
      "id": "def456-account-uuid",
      "status": "ACTIVE"
    },
    "wallet": {
      "id": "ghi789-wallet-uuid",
      "balance": 0,
      "currency": "USD"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save your credentials for the next steps:**

```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export WALLET_ID="ghi789-wallet-uuid"
```

### Step 2: Check Your Wallet Balance

```bash
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/balance" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "walletId": "ghi789-wallet-uuid",
    "balance": 0,
    "availableBalance": 0,
    "currency": "USD"
  }
}
```

### Step 3: Deposit Funds

```bash
curl -X POST "http://localhost:3000/api/v1/wallets/$WALLET_ID/deposit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 10000,
    "referenceId": "initial-deposit-001"
  }'
```

**Response:**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transaction": {
      "id": "txn-uuid",
      "type": "credit",
      "amount": 10000,
      "status": "completed",
      "referenceId": "initial-deposit-001"
    },
    "wallet": {
      "id": "ghi789-wallet-uuid",
      "balance": 10000,
      "currency": "USD"
    }
  }
}
```

### Step 4: Make a Withdrawal

```bash
curl -X POST "http://localhost:3000/api/v1/wallets/$WALLET_ID/withdraw" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 2500,
    "referenceId": "withdrawal-001"
  }'
```

**Response:**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transaction": {
      "id": "txn-uuid-2",
      "type": "debit",
      "amount": 2500,
      "status": "completed",
      "referenceId": "withdrawal-001"
    },
    "wallet": {
      "id": "ghi789-wallet-uuid",
      "balance": 7500,
      "currency": "USD"
    }
  }
}
```

### Step 5: View Transaction History

```bash
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/transactions" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transactions": [
      {
        "id": "txn-uuid",
        "type": "credit",
        "amount": 10000,
        "status": "completed",
        "referenceId": "initial-deposit-001",
        "createdAt": "2025-12-31T10:00:00.000Z"
      },
      {
        "id": "txn-uuid-2",
        "type": "debit",
        "amount": 2500,
        "status": "completed",
        "referenceId": "withdrawal-001",
        "createdAt": "2025-12-31T10:05:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

### Step 6: Login Later

When you return, login to get a new token:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "SecurePassword123!"
  }'
```

---

## Creating an Admin User

By default, all registered users have the `CUSTOMER` role. To create an admin user, you'll need to update the role directly in the database:

```sql
-- After registering, update the user's role
UPDATE User SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

Or use Prisma Studio:

```bash
npx prisma studio
```

Navigate to the User table and change the role field from `CUSTOMER` to `ADMIN`.

### Admin Quick Start

```bash
# 1. Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "AdminPassword123!"
  }'

# Save the admin token
export ADMIN_TOKEN="your-admin-jwt-token"

# 2. List all users
curl -X GET "http://localhost:3000/api/v1/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. List all wallets
curl -X GET "http://localhost:3000/api/v1/admin/wallets" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. List all transactions
curl -X GET "http://localhost:3000/api/v1/admin/transactions" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Freeze a suspicious wallet
curl -X POST "http://localhost:3000/api/v1/admin/wallets/WALLET_ID/freeze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Suspicious activity"}'

# 6. Unfreeze a wallet
curl -X POST "http://localhost:3000/api/v1/admin/wallets/WALLET_ID/unfreeze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 7. Reverse a transaction
curl -X POST "http://localhost:3000/api/v1/admin/transactions/TXN_ID/reverse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Customer refund request"}'
```

---

## Available Scripts

| Script                     | Description              |
| -------------------------- | ------------------------ |
| `npm run dev`              | Start development server |
| `npm run prisma:migrate`   | Run database migrations  |
| `npm run prisma:generate`  | Generate Prisma client   |
| `npm test`                 | Run all tests            |
| `npm run test:unit`        | Run unit tests only      |
| `npm run test:integration` | Run integration tests    |
| `npm run test:e2e`         | Run end-to-end tests     |

## Database Management

### View Database with Prisma Studio

```bash
npx prisma studio
```

> Note: Prisma Studio uses the `DATABASE_URL` (mysql://) connection string.

### Reset Database

```bash
npx prisma migrate reset
```

> ⚠️ Warning: This will delete all data!

---

## Troubleshooting

### Common Issues

#### 1. Prisma Client Not Found

```
Error: Cannot find module '../generated/prisma/client.ts'
```

**Solution**: Generate the Prisma client:

```bash
npm run prisma:generate
```

#### 2. Database Connection Failed

```
Error: P1001: Can't reach database server
```

**Solution**: Ensure MySQL is running and credentials are correct:

```bash
mysql -u root -p -e "SELECT 1;"
```

#### 3. Port Already in Use

```
Error: EADDRINUSE: address already in use :::3000
```

**Solution**: Kill the process or use a different port:

```bash
lsof -ti:3000 | xargs kill -9
```

#### 4. Redis Connection Failed

```
Error: Redis connection refused
```

**Solution**: Ensure Redis is running:

```bash
redis-cli ping
# Should return: PONG
```

#### 5. JWT Token Expired or Invalid

```json
{
  "status": 401,
  "code": "UNAUTHORIZED",
  "error": "Token expired"
}
```

**Solution**: Login again to get a fresh token:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "yourpassword"}'
```

---

## Next Steps

- [003 - API Reference](003-API_REFERENCE.md) - Complete API documentation with cURL examples
- [004 - Authentication](004-AUTHENTICATION.md) - Understand security features and RBAC
- [005 - Database Schema](005-DATABASE_SCHEMA.md) - Data model reference
- [006 - Testing](006-TESTING.md) - Run and write tests
