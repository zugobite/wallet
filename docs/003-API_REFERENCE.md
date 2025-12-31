# 003 - API Reference

## Base URL

```
http://localhost:3000/api/v1
```

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "status": 200,
  "code": "OK",
  "data": { ... }
}
```

### Error Response

```json
{
  "status": 400,
  "code": "BAD_REQUEST",
  "error": "Error message description"
}
```

## Status Codes

| Code | Name                  | Description                               |
| ---- | --------------------- | ----------------------------------------- |
| 200  | OK                    | Request successful                        |
| 201  | CREATED               | Resource created successfully             |
| 400  | BAD_REQUEST           | Invalid request parameters                |
| 401  | UNAUTHORIZED          | Missing or invalid authentication         |
| 403  | FORBIDDEN             | Insufficient permissions (RBAC)           |
| 404  | NOT_FOUND             | Resource not found                        |
| 409  | CONFLICT              | Duplicate transaction or already reversed |
| 422  | INSUFFICIENT_FUNDS    | Wallet balance too low                    |
| 500  | INTERNAL_SERVER_ERROR | Unexpected server error                   |

---

## Public Endpoints

### Health Check

Check if the service is running.

```http
GET /health
```

**cURL Example**

```bash
curl -X GET http://localhost:3000/health
```

**Response**

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

Get API version and available endpoints.

```http
GET /api/v1
```

**cURL Example**

```bash
curl -X GET http://localhost:3000/api/v1
```

**Response**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "version": "1.0.0",
    "endpoints": [
      "POST /api/v1/auth/register",
      "POST /api/v1/auth/login",
      "GET /api/v1/auth/me",
      "POST /api/v1/transactions/authorize",
      "POST /api/v1/transactions/debit",
      "POST /api/v1/transactions/credit",
      "POST /api/v1/transactions/reverse",
      "GET /api/v1/wallets/:id",
      "GET /api/v1/wallets/:id/balance",
      "GET /api/v1/wallets/:id/transactions",
      "POST /api/v1/wallets/:id/deposit",
      "POST /api/v1/wallets/:id/withdraw"
    ]
  }
}
```

---

## Authentication Endpoints

### POST /api/v1/auth/register

Register a new user account with an associated wallet.

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "currency": "USD"
}
```

| Field    | Type   | Required | Description                           |
| -------- | ------ | -------- | ------------------------------------- |
| email    | string | Yes      | Valid email address                   |
| password | string | Yes      | Min 8 characters, max 100             |
| currency | string | No       | 3-letter currency code (default: USD) |

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "currency": "USD"
  }'
```

**Success Response (201 Created)**

```json
{
  "status": 201,
  "code": "CREATED",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "role": "CUSTOMER"
    },
    "account": {
      "id": "account-uuid",
      "status": "ACTIVE"
    },
    "wallet": {
      "id": "wallet-uuid",
      "balance": 0,
      "currency": "USD"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**

| Status | Code        | Condition                 |
| ------ | ----------- | ------------------------- |
| 400    | BAD_REQUEST | Invalid email or password |
| 409    | CONFLICT    | Email already registered  |

---

### POST /api/v1/auth/login

Authenticate an existing user and receive a JWT token.

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "role": "CUSTOMER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**

| Status | Code         | Condition              |
| ------ | ------------ | ---------------------- |
| 400    | BAD_REQUEST  | Missing required field |
| 401    | UNAUTHORIZED | Invalid credentials    |

---

### GET /api/v1/auth/me

Get the current authenticated user's profile.

**Required Headers**

| Header          | Description      |
| --------------- | ---------------- |
| `Authorization` | Bearer JWT token |

**cURL Example**

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "role": "CUSTOMER",
      "createdAt": "2025-12-30T12:00:00.000Z"
    },
    "account": {
      "id": "account-uuid",
      "status": "ACTIVE"
    },
    "wallets": [
      {
        "id": "wallet-uuid",
        "balance": 10000,
        "currency": "USD"
      }
    ]
  }
}
```

---

## Customer Wallet Endpoints

All wallet endpoints require authentication and ownership validation. Customers can only access their own wallets.

### Required Headers

| Header          | Description      |
| --------------- | ---------------- |
| `Authorization` | Bearer JWT token |
| `Content-Type`  | application/json |

---

### GET /api/v1/wallets/:id

Get wallet details.

**cURL Example**

```bash
curl -X GET http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "wallet": {
      "id": "wallet-uuid",
      "accountId": "account-uuid",
      "balance": 10000,
      "currency": "USD",
      "version": 5,
      "createdAt": "2025-12-30T12:00:00.000Z",
      "updatedAt": "2025-12-31T10:30:00.000Z"
    }
  }
}
```

**Error Responses**

| Status | Code         | Condition                     |
| ------ | ------------ | ----------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid token      |
| 404    | NOT_FOUND    | Wallet not found or not owned |

---

### GET /api/v1/wallets/:id/balance

Get current wallet balance.

**cURL Example**

```bash
curl -X GET http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "walletId": "wallet-uuid",
    "balance": 10000,
    "availableBalance": 10000,
    "currency": "USD"
  }
}
```

---

### GET /api/v1/wallets/:id/transactions

Get transaction history for a wallet with pagination support.

**Query Parameters**

| Parameter | Type    | Default | Description                                       |
| --------- | ------- | ------- | ------------------------------------------------- |
| page      | integer | 1       | Page number (min 1)                               |
| limit     | integer | 20      | Results per page (max 100)                        |
| type      | string  | -       | Filter by type: authorize, debit, credit, reverse |
| status    | string  | -       | Filter by status: pending, completed, reversed    |

**cURL Example**

```bash
# Get all transactions (page 1)
curl -X GET "http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/transactions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get page 2 with 10 results, filter by debit type
curl -X GET "http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/transactions?page=2&limit=10&type=debit" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transactions": [
      {
        "id": "txn-uuid-1",
        "walletId": "wallet-uuid",
        "type": "credit",
        "amount": 5000,
        "status": "completed",
        "referenceId": "deposit-001",
        "createdAt": "2025-12-31T10:00:00.000Z"
      },
      {
        "id": "txn-uuid-2",
        "walletId": "wallet-uuid",
        "type": "debit",
        "amount": 1000,
        "status": "completed",
        "referenceId": "purchase-001",
        "createdAt": "2025-12-31T11:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### POST /api/v1/wallets/:id/deposit

Deposit funds into your wallet.

**Request Body**

```json
{
  "amount": 5000,
  "referenceId": "deposit-unique-ref"
}
```

| Field       | Type    | Required | Description                  |
| ----------- | ------- | -------- | ---------------------------- |
| amount      | integer | Yes      | Amount in cents (positive)   |
| referenceId | string  | Yes      | Unique transaction reference |

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 5000,
    "referenceId": "deposit-001"
  }'
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transaction": {
      "id": "txn-uuid",
      "walletId": "wallet-uuid",
      "type": "credit",
      "amount": 5000,
      "status": "completed",
      "referenceId": "deposit-001",
      "createdAt": "2025-12-31T12:00:00.000Z"
    },
    "wallet": {
      "id": "wallet-uuid",
      "balance": 15000,
      "currency": "USD"
    }
  }
}
```

**Error Responses**

| Status | Code        | Condition                             |
| ------ | ----------- | ------------------------------------- |
| 400    | BAD_REQUEST | Invalid amount or missing referenceId |
| 403    | FORBIDDEN   | Account is frozen                     |
| 409    | CONFLICT    | Duplicate referenceId                 |

---

### POST /api/v1/wallets/:id/withdraw

Withdraw funds from your wallet.

**Request Body**

```json
{
  "amount": 2000,
  "referenceId": "withdraw-unique-ref"
}
```

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/wallets/YOUR_WALLET_ID/withdraw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 2000,
    "referenceId": "withdraw-001"
  }'
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transaction": {
      "id": "txn-uuid",
      "walletId": "wallet-uuid",
      "type": "debit",
      "amount": 2000,
      "status": "completed",
      "referenceId": "withdraw-001",
      "createdAt": "2025-12-31T12:05:00.000Z"
    },
    "wallet": {
      "id": "wallet-uuid",
      "balance": 13000,
      "currency": "USD"
    }
  }
}
```

**Error Responses**

| Status | Code               | Condition             |
| ------ | ------------------ | --------------------- |
| 400    | BAD_REQUEST        | Invalid amount        |
| 403    | FORBIDDEN          | Account is frozen     |
| 409    | CONFLICT           | Duplicate referenceId |
| 422    | INSUFFICIENT_FUNDS | Balance too low       |

---

## Transaction Endpoints

Core transaction endpoints for the underlying wallet engine.

### Required Headers

| Header          | Description      |
| --------------- | ---------------- |
| `Authorization` | Bearer JWT token |
| `Content-Type`  | application/json |

---

### POST /api/v1/transactions/authorize

Authorize a pending transaction. Reserves funds without actually debiting the wallet.

**Request Body**

```json
{
  "walletId": "uuid-string",
  "amount": 1000,
  "referenceId": "unique-reference-id"
}
```

| Field       | Type          | Required | Description                  |
| ----------- | ------------- | -------- | ---------------------------- |
| walletId    | string (UUID) | Yes      | Target wallet ID             |
| amount      | integer       | Yes      | Amount in cents              |
| referenceId | string        | Yes      | Unique transaction reference |

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/transactions/authorize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "walletId": "your-wallet-uuid",
    "amount": 1000,
    "referenceId": "auth-001"
  }'
```

**Success Response (201 Created)**

```json
{
  "status": 201,
  "code": "CREATED",
  "data": {
    "id": "transaction-uuid",
    "walletId": "wallet-uuid",
    "type": "authorize",
    "amount": 1000,
    "status": "pending",
    "referenceId": "auth-001",
    "createdAt": "2025-12-30T12:00:00.000Z"
  }
}
```

**Error Responses**

| Status | Code               | Condition               |
| ------ | ------------------ | ----------------------- |
| 400    | BAD_REQUEST        | Missing required fields |
| 404    | NOT_FOUND          | Wallet not found        |
| 409    | CONFLICT           | Duplicate referenceId   |
| 422    | INSUFFICIENT_FUNDS | Balance too low         |

---

### POST /api/v1/transactions/debit

Debit (withdraw) funds from a wallet.

**Request Body**

```json
{
  "walletId": "uuid-string",
  "amount": 1000,
  "referenceId": "unique-reference-id"
}
```

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/transactions/debit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "walletId": "your-wallet-uuid",
    "amount": 1000,
    "referenceId": "debit-001"
  }'
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "walletId": "wallet-uuid",
      "type": "debit",
      "amount": 1000,
      "status": "completed",
      "referenceId": "debit-001",
      "createdAt": "2025-12-30T12:00:00.000Z"
    },
    "wallet": {
      "id": "wallet-uuid",
      "accountId": "account-uuid",
      "balance": 9000,
      "currency": "USD",
      "version": 2
    }
  }
}
```

---

### POST /api/v1/transactions/credit

Credit (deposit) funds to a wallet.

**Request Body**

```json
{
  "walletId": "uuid-string",
  "amount": 5000,
  "referenceId": "unique-reference-id"
}
```

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/transactions/credit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "walletId": "your-wallet-uuid",
    "amount": 5000,
    "referenceId": "credit-001"
  }'
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "walletId": "wallet-uuid",
      "type": "credit",
      "amount": 5000,
      "status": "completed",
      "referenceId": "credit-001",
      "createdAt": "2025-12-30T12:00:00.000Z"
    },
    "wallet": {
      "id": "wallet-uuid",
      "accountId": "account-uuid",
      "balance": 15000,
      "currency": "USD",
      "version": 3
    }
  }
}
```

---

### POST /api/v1/transactions/reverse

Reverse a previous transaction.

**Request Body**

```json
{
  "referenceId": "original-reference-id"
}
```

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/transactions/reverse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "referenceId": "debit-001"
  }'
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "status": "reversed",
    "referenceId": "debit-001"
  }
}
```

**Error Responses**

| Status | Code      | Condition             |
| ------ | --------- | --------------------- |
| 404    | NOT_FOUND | Transaction not found |
| 409    | CONFLICT  | Already reversed      |

---

## Admin Endpoints

Admin endpoints require authentication with an ADMIN role. These endpoints provide oversight and control over the platform.

### Required Headers

| Header          | Description              |
| --------------- | ------------------------ |
| `Authorization` | Bearer JWT token (ADMIN) |
| `Content-Type`  | application/json         |

---

### GET /api/v1/admin/users

List all users with pagination and filtering.

**Query Parameters**

| Parameter | Type    | Default | Description                     |
| --------- | ------- | ------- | ------------------------------- |
| page      | integer | 1       | Page number                     |
| limit     | integer | 20      | Results per page (max 100)      |
| role      | string  | -       | Filter by role: CUSTOMER, ADMIN |

**cURL Example**

```bash
# List all users
curl -X GET "http://localhost:3000/api/v1/admin/users" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Filter by role with pagination
curl -X GET "http://localhost:3000/api/v1/admin/users?role=CUSTOMER&page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "users": [
      {
        "id": "user-uuid-1",
        "email": "customer1@example.com",
        "role": "CUSTOMER",
        "createdAt": "2025-12-30T12:00:00.000Z"
      },
      {
        "id": "user-uuid-2",
        "email": "admin@example.com",
        "role": "ADMIN",
        "createdAt": "2025-12-29T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Error Responses**

| Status | Code         | Condition                |
| ------ | ------------ | ------------------------ |
| 401    | UNAUTHORIZED | Missing or invalid token |
| 403    | FORBIDDEN    | Not an admin             |

---

### GET /api/v1/admin/wallets

List all wallets with pagination and filtering.

**Query Parameters**

| Parameter  | Type    | Default | Description                              |
| ---------- | ------- | ------- | ---------------------------------------- |
| page       | integer | 1       | Page number                              |
| limit      | integer | 20      | Results per page (max 100)               |
| currency   | string  | -       | Filter by currency (e.g., USD)           |
| status     | string  | -       | Filter by account status: ACTIVE, FROZEN |
| minBalance | integer | -       | Minimum balance filter                   |
| maxBalance | integer | -       | Maximum balance filter                   |

**cURL Example**

```bash
# List all wallets
curl -X GET "http://localhost:3000/api/v1/admin/wallets" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Filter by currency and balance
curl -X GET "http://localhost:3000/api/v1/admin/wallets?currency=USD&minBalance=10000" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "wallets": [
      {
        "id": "wallet-uuid-1",
        "accountId": "account-uuid-1",
        "balance": 50000,
        "currency": "USD",
        "account": {
          "id": "account-uuid-1",
          "status": "ACTIVE",
          "user": {
            "email": "user1@example.com"
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 500,
      "totalPages": 25
    }
  }
}
```

---

### GET /api/v1/admin/transactions

List all transactions with pagination and filtering.

**Query Parameters**

| Parameter | Type    | Default | Description                                       |
| --------- | ------- | ------- | ------------------------------------------------- |
| page      | integer | 1       | Page number                                       |
| limit     | integer | 20      | Results per page (max 100)                        |
| type      | string  | -       | Filter by type: authorize, debit, credit, reverse |
| status    | string  | -       | Filter by status: pending, completed, reversed    |
| walletId  | string  | -       | Filter by wallet ID                               |

**cURL Example**

```bash
# List all transactions
curl -X GET "http://localhost:3000/api/v1/admin/transactions" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Filter by type and status
curl -X GET "http://localhost:3000/api/v1/admin/transactions?type=debit&status=completed&page=1&limit=50" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "transactions": [
      {
        "id": "txn-uuid-1",
        "walletId": "wallet-uuid",
        "type": "debit",
        "amount": 5000,
        "status": "completed",
        "referenceId": "purchase-001",
        "createdAt": "2025-12-31T10:00:00.000Z",
        "wallet": {
          "currency": "USD",
          "account": {
            "user": {
              "email": "user@example.com"
            }
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10000,
      "totalPages": 500
    }
  }
}
```

---

### POST /api/v1/admin/wallets/:id/freeze

Freeze a wallet's account to prevent transactions.

**Request Body**

```json
{
  "reason": "Suspicious activity detected"
}
```

| Field  | Type   | Required | Description                         |
| ------ | ------ | -------- | ----------------------------------- |
| reason | string | No       | Reason for freezing (max 500 chars) |

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/admin/wallets/WALLET_ID/freeze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{
    "reason": "Suspicious activity detected"
  }'
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "message": "Wallet frozen successfully",
    "walletId": "wallet-uuid",
    "accountStatus": "FROZEN"
  }
}
```

**Error Responses**

| Status | Code      | Condition        |
| ------ | --------- | ---------------- |
| 404    | NOT_FOUND | Wallet not found |
| 409    | CONFLICT  | Already frozen   |

---

### POST /api/v1/admin/wallets/:id/unfreeze

Unfreeze a wallet's account to allow transactions.

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/admin/wallets/WALLET_ID/unfreeze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "message": "Wallet unfrozen successfully",
    "walletId": "wallet-uuid",
    "accountStatus": "ACTIVE"
  }
}
```

**Error Responses**

| Status | Code      | Condition        |
| ------ | --------- | ---------------- |
| 404    | NOT_FOUND | Wallet not found |
| 409    | CONFLICT  | Already active   |

---

### POST /api/v1/admin/transactions/:id/reverse

Admin reversal of a completed transaction.

**Request Body**

```json
{
  "reason": "Customer dispute - refund authorized"
}
```

| Field  | Type   | Required | Description                         |
| ------ | ------ | -------- | ----------------------------------- |
| reason | string | Yes      | Reason for reversal (max 500 chars) |

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/v1/admin/transactions/TRANSACTION_ID/reverse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{
    "reason": "Customer dispute - refund authorized"
  }'
```

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "message": "Transaction reversed successfully",
    "transactionId": "txn-uuid",
    "status": "reversed",
    "reversalReason": "Customer dispute - refund authorized"
  }
}
```

**Error Responses**

| Status | Code          | Condition                |
| ------ | ------------- | ------------------------ |
| 400    | BAD_REQUEST   | Missing reason           |
| 404    | NOT_FOUND     | Transaction not found    |
| 409    | CONFLICT      | Already reversed         |
| 422    | UNPROCESSABLE | Cannot reverse this type |

---

## Complete End-to-End Examples

### Customer Flow: Register, Deposit, Withdraw

```bash
# 1. Register a new account
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "MySecurePassword123!"
  }'

# Save the token from the response
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export WALLET_ID="wallet-uuid-from-response"

# 2. Check your wallet balance
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/balance" \
  -H "Authorization: Bearer $TOKEN"

# 3. Deposit funds
curl -X POST "http://localhost:3000/api/v1/wallets/$WALLET_ID/deposit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 10000,
    "referenceId": "initial-deposit-001"
  }'

# 4. Check balance again
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/balance" \
  -H "Authorization: Bearer $TOKEN"

# 5. Withdraw some funds
curl -X POST "http://localhost:3000/api/v1/wallets/$WALLET_ID/withdraw" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 2500,
    "referenceId": "withdrawal-001"
  }'

# 6. View transaction history
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/transactions" \
  -H "Authorization: Bearer $TOKEN"
```

### Admin Flow: Monitor and Control

```bash
# 1. Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "AdminPassword123!"
  }'

# Save the admin token
export ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. List all users
curl -X GET "http://localhost:3000/api/v1/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. List all wallets with high balances
curl -X GET "http://localhost:3000/api/v1/admin/wallets?minBalance=100000" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. View recent transactions
curl -X GET "http://localhost:3000/api/v1/admin/transactions?limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Freeze a suspicious wallet
curl -X POST "http://localhost:3000/api/v1/admin/wallets/WALLET_ID/freeze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "reason": "Unusual transaction pattern"
  }'

# 6. Reverse a fraudulent transaction
curl -X POST "http://localhost:3000/api/v1/admin/transactions/TXN_ID/reverse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "reason": "Confirmed fraud - customer refund"
  }'

# 7. Unfreeze wallet after investigation
curl -X POST "http://localhost:3000/api/v1/admin/wallets/WALLET_ID/unfreeze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Next Steps

- [004 - Authentication](004-AUTHENTICATION.md) - JWT and signature details
- [005 - Database Schema](005-DATABASE_SCHEMA.md) - Data model reference
