# 007 - Deployment

## Overview

The Wallet Service supports multiple deployment targets:

- **Traditional Server** - Node.js on VPS/dedicated server
- **Serverless** - AWS Lambda, Vercel, Netlify
- **Containerized** - Docker, Kubernetes

---

## Environment Configuration

### Production Environment Variables

```dotenv
NODE_ENV=production

# Security (generate fresh secrets for production!)
JWT_SECRET=<production-64-byte-hex>
REQUEST_SIGNING_SECRET=<production-64-byte-hex>
SIGNATURE_TTL_MS=300000

# Database
DATABASE_URL="mysql://user:password@host:3306/wallet_prod"
DATABASE_ADAPTER_URL="mariadb://user:password@host:3306/wallet_prod"

# Redis (for signature replay protection)
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>
```

### Generate Production Secrets

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate signing secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 wallet

COPY --from=builder --chown=wallet:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=wallet:nodejs /app/src ./src
COPY --from=builder --chown=wallet:nodejs /app/prisma ./prisma
COPY --from=builder --chown=wallet:nodejs /app/package.json ./

USER wallet

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/app.mjs"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  wallet:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - REQUEST_SIGNING_SECRET=${REQUEST_SIGNING_SECRET}
      - DATABASE_URL=${DATABASE_URL}
      - DATABASE_ADAPTER_URL=${DATABASE_ADAPTER_URL}
    depends_on:
      - db
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: wallet
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  mysql_data:
  redis_data:
```

### Build and Run

```bash
# Build image
docker build -t wallet-service .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f wallet

# Run migrations
docker-compose exec wallet npx prisma migrate deploy
```

---

## AWS Lambda Deployment

The service includes `serverless-http` for Lambda compatibility.

### serverless.yml

```yaml
service: wallet-service

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  environment:
    NODE_ENV: production
    JWT_SECRET: ${ssm:/wallet/jwt-secret}
    REQUEST_SIGNING_SECRET: ${ssm:/wallet/signing-secret}
    DATABASE_URL: ${ssm:/wallet/database-url}
    DATABASE_ADAPTER_URL: ${ssm:/wallet/database-adapter-url}

functions:
  api:
    handler: src/app.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
      - http:
          path: /
          method: ANY

plugins:
  - serverless-offline
```

### Deploy to AWS

```bash
# Install serverless
npm install -g serverless

# Deploy
serverless deploy --stage production
```

---

## Database Migration Strategy

### Production Migrations

Never run `prisma migrate dev` in production. Use:

```bash
npx prisma migrate deploy
```

This only applies existing migrations without creating new ones.

### Migration Workflow

1. **Development**: Create migrations with `prisma migrate dev`
2. **Staging**: Test with `prisma migrate deploy`
3. **Production**: Apply with `prisma migrate deploy`

---

## Health Checks

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Load Balancer Health Check

Configure your load balancer to check:

- **Path**: `/health`
- **Expected**: HTTP 200
- **Interval**: 30 seconds
- **Timeout**: 10 seconds

---

## Security Checklist

### Before Deployment

- [ ] Generate fresh production secrets
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS appropriately
- [ ] Set up rate limiting
- [ ] Enable security headers (Helmet.js)
- [ ] Review database credentials
- [ ] Enable audit logging
- [ ] Configure backup strategy

### Environment Security

- [ ] Use environment variables for secrets
- [ ] Never commit secrets to git
- [ ] Use secret management (AWS Secrets Manager, Vault)
- [ ] Rotate secrets periodically

---

## Monitoring

### Recommended Tools

| Tool       | Purpose            |
| ---------- | ------------------ |
| Prometheus | Metrics collection |
| Grafana    | Visualization      |
| ELK Stack  | Log aggregation    |
| Sentry     | Error tracking     |
| PagerDuty  | Alerting           |

### Key Metrics to Monitor

- Request latency (p50, p95, p99)
- Error rate
- Transaction success rate
- Database connection pool
- Memory usage
- CPU usage

---

## Scaling Considerations

### Horizontal Scaling

The service is stateless and can be horizontally scaled:

```yaml
# Kubernetes deployment
replicas: 3
```

### Database Scaling

- Use read replicas for read-heavy workloads
- Consider connection pooling (PgBouncer equivalent for MySQL)
- Implement caching for frequently accessed data

### Redis Scaling

- Use Redis Cluster for high availability
- Configure appropriate memory limits
- Monitor memory usage

---

## Rollback Strategy

### Application Rollback

```bash
# Docker
docker-compose down
docker-compose up -d --force-recreate

# Kubernetes
kubectl rollout undo deployment/wallet-service
```

### Database Rollback

Prisma doesn't support automatic rollback. Options:

1. Restore from backup
2. Create a counter-migration
3. Use `prisma migrate resolve` to mark migrations

---

## Support

For issues and questions:

- Open an issue on GitHub
- Check the documentation
- Review logs for error details
