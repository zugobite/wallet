# 006 - Testing Guide

This document provides comprehensive guidance on testing the Wallet Transaction API.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Test Coverage](#test-coverage)
6. [CI/CD Integration](#cicd-integration)

---

## Testing Philosophy

The wallet API follows a **testing pyramid** approach:

```
        /\
       /  \      E2E Tests (Few, Slow, High Confidence)
      /----\
     /      \    Unit Tests (Many, Fast, Isolated)
    /________\
```

### Testing Principles

1. **Isolation**: Unit tests should not depend on external services
2. **Determinism**: Tests must produce consistent results
3. **Speed**: Fast feedback loop is essential
4. **Coverage**: Critical paths must be thoroughly tested
5. **Readability**: Tests serve as documentation

---

## Test Structure

```
tests/
├── setup.js                          # Global test setup
├── unit/
│   ├── domain/
│   │   ├── wallet.test.js            # Wallet domain logic
│   │   └── transactions.test.js      # Transaction domain logic
│   ├── middleware/
│   │   ├── auth.test.js              # Authentication logic
│   │   ├── idempotency.test.js       # Idempotency logic
│   │   └── signature.test.js         # Signature verification logic
│   └── utils/
│       └── canonicalJson.test.js     # JSON canonicalization
└── e2e/
    └── health.e2e.test.js            # Health endpoint tests
```

---

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests Only

```bash
npm run test:unit
```

### Integration Tests Only

```bash
npm run test:integration
```

### End-to-End Tests Only

```bash
npm run test:e2e
```

### Watch Mode (Development)

```bash
npm run test:watch
```

### With Coverage Report

```bash
npm run test:coverage
```

### Specific Test File

```bash
npm test -- tests/unit/middleware/auth.test.js
```

### Tests Matching Pattern

```bash
npm test -- --testNamePattern="should return 401"
```

---

## Writing Tests

### Unit Test Example

```javascript
import {
  assertWalletExists,
  assertSufficientBalance,
} from "../../../src/domain/wallet.mjs";

describe("Wallet Domain", () => {
  describe("assertSufficientBalance", () => {
    it("should not throw for sufficient balance", () => {
      const wallet = { balance: 5000, pendingBalance: 1000 };
      expect(() => assertSufficientBalance(wallet, 3000)).not.toThrow();
    });

    it("should throw for insufficient balance", () => {
      const wallet = { balance: 1000, pendingBalance: 500 };
      expect(() => assertSufficientBalance(wallet, 1000)).toThrow(
        "Insufficient balance"
      );
    });
  });
});
```

### Integration Test Example

```javascript
jest.mock("../../../src/infra/prisma.mjs");
jest.mock("../../../src/domain/wallet.mjs");

import authorize from "../../../src/handlers/authorize.mjs";

describe("Authorize Handler", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { account: { id: "account-123" } },
      body: { walletId: "wallet-123", amount: 1000, referenceId: "ref-123" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("should return 201 for successful authorization", async () => {
    // Setup mocks...
    await authorize(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
```

### E2E Test Example

```javascript
import request from "supertest";
import app from "../../src/app.mjs";

describe("Health Endpoint", () => {
  it("should return 200 without authentication", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe("Service is healthy");
  });
});
```

---

## Mocking Strategies

### Mocking Prisma

```javascript
jest.mock("../../../src/infra/prisma.mjs", () => ({
  prisma: {
    account: {
      findUnique: jest.fn(),
    },
    wallet: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
```

### Mocking Redis

```javascript
jest.mock("../../../src/infra/redis.mjs", () => ({
  redis: {
    set: jest.fn().mockResolvedValue("OK"),
    get: jest.fn(),
  },
}));
```

### Mocking JWT

```javascript
import jwt from "jsonwebtoken";

const generateTestToken = (userId, expiresIn = "1h") => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn });
};
```

---

## Test Coverage

### Coverage Requirements

| Metric     | Minimum | Target |
| ---------- | ------- | ------ |
| Branches   | 70%     | 85%    |
| Functions  | 70%     | 85%    |
| Lines      | 70%     | 85%    |
| Statements | 70%     | 85%    |

### Viewing Coverage Report

After running `npm run test:coverage`, open `coverage/lcov-report/index.html` in your browser.

### Critical Coverage Areas

These files **must** have 90%+ coverage:

- `src/handlers/*.mjs` - Transaction handlers
- `src/middleware/auth.mjs` - Authentication
- `src/domain/*.mjs` - Business logic

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: wallet_test
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: mysql://root:test@localhost:3306/wallet_test

      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: mysql://root:test@localhost:3306/wallet_test
          DATABASE_ADAPTER_URL: mariadb://root:test@localhost:3306/wallet_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-jwt-secret
          REQUEST_SIGNING_SECRET: test-signing-secret

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

---

## Testing Best Practices

### Do's ✅

- **Describe what** is being tested and **expected behavior**
- Use **descriptive test names** that read like documentation
- **Arrange-Act-Assert** pattern for test structure
- **Mock external dependencies** at the boundary
- Test **edge cases** and error paths
- Keep tests **independent** and **isolated**

### Don'ts ❌

- **Don't test implementation details** - test behavior
- **Don't share state** between tests
- **Don't make tests dependent** on execution order
- **Don't ignore flaky tests** - fix them immediately
- **Don't test external libraries** - trust they work
- **Don't write tests after bugs** - write them before fixes

---

## Debugging Tests

### Running in Debug Mode

```bash
node --inspect-brk node_modules/.bin/jest --runInBand tests/unit/middleware/auth.test.js
```

### Common Issues

**ES Modules not working:**

```bash
NODE_OPTIONS='--experimental-vm-modules' npm test
```

**Tests hanging:**

- Check for unclosed database connections
- Add `forceExit: true` to jest.config.mjs
- Add `detectOpenHandles: true` for debugging

**Mocks not resetting:**

- Ensure `jest.clearAllMocks()` in `beforeEach`
- Check `restoreMocks: true` in config

---

## Next Steps

- [001 - Architecture Overview](001-architecture.md)
- [002 - API Reference](002-api-reference.md)
- [003 - Authentication](003-authentication.md)
