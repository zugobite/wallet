# 004 - Authentication

## Overview

The Wallet Service uses a multi-layered security approach:

1. **JWT Authentication** - Token-based user authentication
2. **Role-Based Access Control (RBAC)** - Permission management by user role
3. **Request Signing** - HMAC-SHA256 signature validation (optional)
4. **Replay Protection** - Nonce-based duplicate request prevention

---

## JWT Authentication

### Token Structure

The service expects a JWT token in the Authorization header:

```http
Authorization: Bearer <token>
```

### Token Payload

```json
{
  "sub": "user-uuid",
  "role": "CUSTOMER",
  "iat": 1704067200,
  "exp": 1704153600
}
```

| Field | Description                        |
| ----- | ---------------------------------- |
| sub   | User ID (used to find the account) |
| role  | User role (CUSTOMER or ADMIN)      |
| iat   | Issued at timestamp                |
| exp   | Expiration timestamp               |

### Obtaining a Token

#### Register a New Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "currency": "USD"
  }'
```

**Response includes a JWT token:**

```json
{
  "status": 201,
  "code": "CREATED",
  "data": {
    "user": { "id": "user-uuid", "email": "user@example.com", "role": "CUSTOMER" },
    "wallet": { "id": "wallet-uuid", "balance": 0, "currency": "USD" },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login to Existing Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Response:**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "user": { "id": "user-uuid", "email": "user@example.com", "role": "CUSTOMER" },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Get Current User Profile

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using Tokens in Requests

Include the token in the Authorization header for all protected endpoints:

```bash
curl -X GET "http://localhost:3000/api/v1/wallets/WALLET_ID/balance" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Token Validation Flow

```
┌─────────────────┐
│  Client Request │
│  with JWT Token │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract Token   │
│ from Header     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Verify Token    │────▶│ 401 UNAUTHORIZED│
│ Signature       │ No  │ Invalid token   │
└────────┬────────┘     └─────────────────┘
         │ Yes
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Check Token     │────▶│ 401 UNAUTHORIZED│
│ Expiration      │ No  │ Token expired   │
└────────┬────────┘     └─────────────────┘
         │ Yes
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Load Account    │────▶│ 401 UNAUTHORIZED│
│ from Database   │ No  │ Account not     │
└────────┬────────┘     │ found           │
         │ Yes          └─────────────────┘
         ▼
┌─────────────────┐
│ Set req.user    │
│ Continue        │
└─────────────────┘
```

---

## Role-Based Access Control (RBAC)

The platform supports two user roles with different permissions:

### User Roles

| Role     | Description                    | Access Level                          |
| -------- | ------------------------------ | ------------------------------------- |
| CUSTOMER | Regular user                   | Own wallets and transactions only     |
| ADMIN    | Platform administrator         | All users, wallets, and transactions  |

### Endpoint Access Matrix

| Endpoint Category        | CUSTOMER | ADMIN |
| ------------------------ | -------- | ----- |
| Auth (register/login/me) | ✅       | ✅    |
| Own Wallet Read          | ✅       | ✅    |
| Own Wallet Deposit       | ✅       | ✅    |
| Own Wallet Withdraw      | ✅       | ✅    |
| Transaction Endpoints    | ✅       | ✅    |
| Admin: List Users        | ❌       | ✅    |
| Admin: List Wallets      | ❌       | ✅    |
| Admin: List Transactions | ❌       | ✅    |
| Admin: Freeze Wallet     | ❌       | ✅    |
| Admin: Unfreeze Wallet   | ❌       | ✅    |
| Admin: Reverse Txn       | ❌       | ✅    |

### RBAC Middleware

The RBAC middleware checks the user's role before allowing access:

```javascript
// Require ADMIN role
app.use("/api/v1/admin", requireAdmin);

// Require any authenticated user
app.use("/api/v1/wallets", requireAuthenticated);

// Require specific roles
app.use("/api/v1/special", requireRoles("ADMIN", "MANAGER"));
```

### Creating an Admin User

By default, all registered users have the `CUSTOMER` role. To create an admin:

**Option 1: Direct Database Update**

```sql
UPDATE User SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

**Option 2: Using Prisma Studio**

```bash
npx prisma studio
```

Navigate to the User table and change the role field.

### Testing Role-Based Access

**As a Customer (403 Forbidden):**

```bash
# Customer trying to access admin endpoints
curl -X GET "http://localhost:3000/api/v1/admin/users" \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
```

**Response:**

```json
{
  "status": 403,
  "code": "FORBIDDEN",
  "error": "Insufficient permissions"
}
```

**As an Admin (200 OK):**

```bash
curl -X GET "http://localhost:3000/api/v1/admin/users" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**

```json
{
  "status": 200,
  "code": "OK",
  "data": {
    "users": [...],
    "pagination": {...}
  }
}
```

---

## Request Signing (Advanced)

For high-security environments, requests can be signed using HMAC-SHA256.

### Required Headers

| Header              | Description                      |
| ------------------- | -------------------------------- |
| x-signature         | HMAC-SHA256 signature (hex)      |
| x-signature-version | Version identifier (v1)          |
| x-timestamp         | Request timestamp (epoch ms)     |
| x-nonce             | Unique request identifier (UUID) |

### Signature Generation

The signature is computed over a canonical representation:

```javascript
import crypto from "crypto";

function signRequest(method, url, timestamp, nonce, body, secret) {
  const payload = [
    method.toUpperCase(),
    url,
    timestamp,
    nonce,
    canonicalJson(body),
  ].join("|");

  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function canonicalJson(obj) {
  if (!obj || typeof obj !== "object") return "";
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}
```

### Example Signed Request

```bash
# Generate signature components
TIMESTAMP=$(date +%s000)
NONCE=$(uuidgen)
BODY='{"walletId":"xxx","amount":1000,"referenceId":"ref-001"}'

# In practice, calculate the signature using the function above
SIGNATURE="calculated-hmac-signature"

curl -X POST http://localhost:3000/api/v1/transactions/debit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Signature: $SIGNATURE" \
  -H "X-Signature-Version: v1" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Nonce: $NONCE" \
  -d "$BODY"
```

### JavaScript Example

```javascript
const method = "POST";
const url = "/api/v1/transactions/debit";
const timestamp = Date.now().toString();
const nonce = crypto.randomUUID();
const body = { walletId: "xxx", amount: 1000, referenceId: "ref-001" };

const signature = signRequest(
  method,
  url,
  timestamp,
  nonce,
  body,
  process.env.REQUEST_SIGNING_SECRET
);

// Request with signature headers
fetch(`http://localhost:3000${url}`, {
  method,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
    "x-signature": signature,
    "x-signature-version": "v1",
    "x-timestamp": timestamp,
    "x-nonce": nonce,
  },
  body: JSON.stringify(body),
});
```

---

## Replay Protection

The signature middleware prevents replay attacks by:

1. **Timestamp Validation** - Requests must be within `SIGNATURE_TTL_MS` of current time
2. **Nonce Tracking** - Each nonce can only be used once (stored in Redis)

```javascript
// Replay protection check
const nonceKey = `nonce:${nonce}`;
const seen = await redis.get(nonceKey);

if (seen) {
  return res.status(401).json({ error: "Replay detected" });
}

await redis.set(nonceKey, "1", "PX", ttl);
```

---

## Security Best Practices

### 1. Secret Management

```bash
# Generate secure secrets (64 bytes = 128 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Never:**

- Commit secrets to version control
- Use weak or predictable secrets
- Share secrets across environments

### 2. Token Expiration

Keep token lifetimes short:

- Access tokens: 15 minutes to 1 hour
- Refresh tokens: 7-30 days

### 3. HTTPS

Always use HTTPS in production to prevent token interception.

### 4. Rate Limiting

Implement rate limiting to prevent brute force attacks:

```javascript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api/", limiter);
```

---

## Error Responses

### 401 UNAUTHORIZED

```json
{
  "status": 401,
  "code": "UNAUTHORIZED",
  "error": "Missing or invalid Authorization header"
}
```

**Possible causes:**

- Missing Authorization header
- Invalid token format
- Expired token
- Invalid signature
- Account not found

**cURL to test:**

```bash
# Missing token
curl -X GET http://localhost:3000/api/v1/wallets/xxx

# Invalid token
curl -X GET http://localhost:3000/api/v1/wallets/xxx \
  -H "Authorization: Bearer invalid-token"
```

### 403 FORBIDDEN

```json
{
  "status": 403,
  "code": "FORBIDDEN",
  "error": "Insufficient permissions"
}
```

**Possible causes:**

- User role doesn't have access to the endpoint
- Trying to access another user's wallet
- Account is frozen

**cURL to test:**

```bash
# Customer trying admin endpoint
curl -X GET http://localhost:3000/api/v1/admin/users \
  -H "Authorization: Bearer CUSTOMER_TOKEN"

# Accessing wallet not owned by user
curl -X GET http://localhost:3000/api/v1/wallets/OTHER_USER_WALLET_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Complete Authentication Flow

```bash
# 1. Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "new@example.com", "password": "SecurePass123!"}'

# 2. Save the token
export TOKEN="token-from-response"
export WALLET_ID="wallet-id-from-response"

# 3. Use protected endpoints
curl -X GET "http://localhost:3000/api/v1/wallets/$WALLET_ID/balance" \
  -H "Authorization: Bearer $TOKEN"

# 4. Later, login again
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "new@example.com", "password": "SecurePass123!"}'

# 5. Get profile
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Next Steps

- [005 - Database Schema](005-DATABASE_SCHEMA.md) - Data model details
- [006 - Testing](006-TESTING.md) - Test with authentication
