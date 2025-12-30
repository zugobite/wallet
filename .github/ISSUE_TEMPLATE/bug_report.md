---
name: Bug Report
about: Report a bug to help us improve
title: "[BUG] "
labels: bug, triage
assignees: ""
---

## Describe the Bug

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behavior:

1. Send request to '...'
2. With headers '...'
3. With payload '...'
4. See error

## Expected Behavior

A clear and concise description of what you expected to happen.

## Actual Behavior

What actually happened instead.

## Request/Response Details

If applicable, include the request and response:

**Request:**

```bash
curl -X POST http://localhost:3000/api/v1/transactions/... \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**Response:**

```json
{
  "status": 500,
  "code": "INTERNAL_ERROR",
  "message": "..."
}
```

## Error Logs

If applicable, include relevant error logs:

```
Paste error logs here
```

## Environment

- **Node.js version**: [e.g., 20.10.0]
- **OS**: [e.g., macOS 14.0, Ubuntu 22.04]
- **MySQL version**: [e.g., 8.0.35]
- **Redis version**: [e.g., 7.2.0]
- **Project version/commit**: [e.g., v1.0.0 or commit SHA]

## Additional Context

Add any other context about the problem here.

## Possible Solution

If you have suggestions on how to fix the bug, please describe them here.
