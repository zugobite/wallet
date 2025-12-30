# 004 - Authentication

## Overview

The Wallet Service uses a multi-layered security approach:

1. **JWT Authentication** - Token-based user authentication
2. **Request Signing** - HMAC-SHA256 signature validation (optional)
3. **Replay Protection** - Nonce-based duplicate request prevention

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
  "iat": 1704067200,
  "exp": 1704153600
}
```

| Field | Description                        |
| ----- | ---------------------------------- |
| sub   | User ID (used to find the account) |
| iat   | Issued at timestamp                |
| exp   | Expiration timestamp               |

### Generating a JWT Token

For development and testing:

```javascript
import jwt from "jsonwebtoken";

const token = jwt.sign({ sub: "user-uuid-here" }, process.env.JWT_SECRET, {
  expiresIn: "24h",
});

console.log(token);
```

Or using the command line:

```bash
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { sub: 'test-user-id' },
  '${process.env.JWT_SECRET}',
  { expiresIn: '24h' }
);
console.log(token);
"
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

Possible causes:

- Missing Authorization header
- Invalid token format
- Expired token
- Invalid signature
- Account not found

---

## Next Steps

- [005 - Database Schema](005-DATABASE_SCHEMA.md) - Data model details
- [006 - Testing](006-TESTING.md) - Test with authentication
