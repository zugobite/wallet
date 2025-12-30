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
git clone https://github.com/zasciahugo/wallet.git
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
    "endpoints": [
      "POST /api/v1/transactions/authorize",
      "POST /api/v1/transactions/debit",
      "POST /api/v1/transactions/credit",
      "POST /api/v1/transactions/reverse"
    ]
  }
}
```

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

## Next Steps

- [003 - API Reference](003-API_REFERENCE.md) - Learn the API endpoints
- [004 - Authentication](004-AUTHENTICATION.md) - Understand security features
- [006 - Testing](006-TESTING.md) - Run and write tests
