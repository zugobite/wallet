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

**Response**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "version": "1.0.0",
    "endpoints": [
      "POST /api/v1/transactions/authorize",
      "POST /api/v1/transactions/debit",
      "POST /api/v1/transactions/credit",
      "POST /api/v1/transactions/reverse"
    ]
  }
}
```

---

## Protected Endpoints

All transaction endpoints require authentication. See [004 - Authentication](004-AUTHENTICATION.md) for details.

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
    "referenceId": "unique-reference-id",
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
      "referenceId": "unique-reference-id",
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
      "referenceId": "unique-reference-id",
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

**Success Response (200 OK)**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "status": "reversed",
    "referenceId": "original-reference-id"
  }
}
```

**Error Responses**

| Status | Code      | Condition             |
| ------ | --------- | --------------------- |
| 404    | NOT_FOUND | Transaction not found |
| 409    | CONFLICT  | Already reversed      |

---

## Example cURL Commands

### Health Check

```bash
curl -X GET http://localhost:3000/health
```

### Create a Debit (with JWT)

```bash
curl -X POST http://localhost:3000/api/v1/transactions/debit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "walletId": "your-wallet-uuid",
    "amount": 1000,
    "referenceId": "txn-001"
  }'
```

### Reverse a Transaction

```bash
curl -X POST http://localhost:3000/api/v1/transactions/reverse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "referenceId": "txn-001"
  }'
```

---

## Next Steps

- [004 - Authentication](004-AUTHENTICATION.md) - JWT and signature details
- [005 - Database Schema](005-DATABASE_SCHEMA.md) - Data model reference
