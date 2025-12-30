# Contributing to Wallet Transaction API

First off, thank you for considering contributing to the Wallet Transaction API.

It's people like you that make this project better for everyone. This document provides guidelines and steps for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Commit Messages](#commit-messages)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inclusive environment. By participating, you are expected to:

- Be respectful and considerate in your communication
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- Node.js 20.x or higher installed
- MySQL 8.x or MariaDB 10.x running
- Redis 7.x running
- Git installed and configured

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/wallet.git
cd wallet
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/wallet.git
```

4. Keep your fork synced:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When creating a bug report, include:

- **Clear title** - A descriptive title that summarizes the issue
- **Steps to reproduce** - Detailed steps to reproduce the behavior
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Environment** - Node version, OS, database version
- **Logs/Screenshots** - Any relevant error messages or screenshots

Use this template:

```markdown
**Describe the bug**
A clear description of the bug.

**To Reproduce**

1. Send request to '...'
2. With payload '...'
3. See error

**Expected behavior**
What should have happened.

**Environment:**

- Node.js: [e.g., 20.10.0]
- OS: [e.g., macOS 14.0]
- MySQL: [e.g., 8.0.35]

**Additional context**
Any other context about the problem.
```

### Suggesting Features

Feature suggestions are welcome! Please:

1. Check if the feature has already been suggested
2. Open an issue with the `feature request` label
3. Describe the feature and its use case
4. Explain why this would benefit the project

### Code Contributions

1. Look for issues labeled `good first issue` or `help wanted`
2. Comment on the issue to let others know you're working on it
3. Follow the development setup and pull request process below

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your local configuration
```

Required environment variables:

| Variable                 | Description                     |
| ------------------------ | ------------------------------- |
| `DATABASE_URL`           | MySQL connection string         |
| `DATABASE_ADAPTER_URL`   | MariaDB adapter URL             |
| `REDIS_URL`              | Redis connection string         |
| `JWT_SECRET`             | JWT signing secret (64+ bytes)  |
| `REQUEST_SIGNING_SECRET` | HMAC signing secret (64+ bytes) |
| `SIGNATURE_TTL_MS`       | Request validity window         |

### 3. Set Up Database

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Run Tests

```bash
npm test
```

## Pull Request Process

### 1. Create a Branch

Create a branch from `main` with a descriptive name:

```bash
git checkout -b feature/add-batch-transactions
git checkout -b fix/signature-validation-error
git checkout -b docs/update-api-reference
```

Branch naming conventions:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/domain/wallet.test.js

# Run tests with coverage
npm run test:coverage
```

Ensure all tests pass before submitting.

### 4. Commit Your Changes

Follow our commit message conventions (see below).

```bash
git add .
git commit -m "feat: add batch transaction support"
```

### 5. Push and Create PR

```bash
git push origin feature/add-batch-transactions
```

Then create a Pull Request on GitHub with:

- **Clear title** describing the change
- **Description** explaining what and why
- **Link to related issue** (if applicable)
- **Screenshots** (for UI changes)

### 6. Code Review

- Respond to review feedback
- Make requested changes
- Keep the PR updated with main

## Style Guidelines

### Code Style

We use ESLint and Prettier for code formatting. Run before committing:

```bash
npm run lint
npm run format
```

### JavaScript/ES Modules

- Use ES modules (`.mjs` extension)
- Use `const` by default, `let` when reassignment is needed
- Use arrow functions for callbacks
- Use async/await over raw Promises
- Destructure objects and arrays when appropriate

```javascript
// ✅ Good
export const processTransaction = async ({ walletId, amount }) => {
  const wallet = await getWallet(walletId);
  return wallet.debit(amount);
};

// ❌ Avoid
module.exports.processTransaction = function (options) {
  return getWallet(options.walletId).then(function (wallet) {
    return wallet.debit(options.amount);
  });
};
```

### Naming Conventions

- **Files**: `camelCase.mjs` for modules, `kebab-case.mjs` for configs
- **Variables/Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Classes**: `PascalCase`

### Error Handling

- Always handle errors appropriately
- Use meaningful error messages
- Include relevant context in errors

```javascript
// ✅ Good
if (!wallet) {
  throw new Error(`Wallet not found: ${walletId}`);
}

// ❌ Avoid
if (!wallet) {
  throw new Error("Error");
}
```

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Description                        |
| ---------- | ---------------------------------- |
| `feat`     | New feature                        |
| `fix`      | Bug fix                            |
| `docs`     | Documentation only                 |
| `style`    | Formatting, no code change         |
| `refactor` | Code change, no new feature or fix |
| `test`     | Adding or updating tests           |
| `chore`    | Maintenance, dependencies          |
| `perf`     | Performance improvement            |

### Examples

```bash
feat(auth): add JWT refresh token support

fix(signature): correct timestamp validation for edge cases

docs(api): update authorization endpoint examples

test(wallet): add unit tests for balance calculation

chore(deps): update prisma to v7.3.0
```

### Guidelines

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor" not "moves cursor")
- Limit first line to 72 characters
- Reference issues in footer: `Closes #123`

## Testing

### Test Structure

```
tests/
├── setup.js           # Global test configuration
├── unit/              # Unit tests
│   ├── domain/        # Domain logic tests
│   ├── middleware/    # Middleware tests
│   └── utils/         # Utility tests
└── e2e/               # End-to-end tests
```

### Writing Tests

- Place tests next to the code they test (in `tests/` mirror structure)
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern
- Mock external dependencies

```javascript
import { describe, it, expect } from "@jest/globals";

describe("Wallet", () => {
  describe("debit", () => {
    it("should reduce balance by debit amount", () => {
      // Arrange
      const initialBalance = 1000;
      const debitAmount = 250;

      // Act
      const newBalance = initialBalance - debitAmount;

      // Assert
      expect(newBalance).toBe(750);
    });

    it("should throw error for insufficient funds", () => {
      // Test insufficient funds scenario
    });
  });
});
```

### Test Commands

```bash
npm test                 # Run all tests
npm run test:unit        # Run unit tests
npm run test:e2e         # Run E2E tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## Documentation

When contributing, please update relevant documentation:

- **Code comments** - For complex logic
- **JSDoc** - For public functions
- **README.md** - For user-facing changes
- **docs/** - For detailed documentation

### Documentation Structure

| File                           | Purpose               |
| ------------------------------ | --------------------- |
| `docs/001-PROJECT_OVERVIEW.md` | Architecture overview |
| `docs/002-GETTING_STARTED.md`  | Setup guide           |
| `docs/003-API_REFERENCE.md`    | API documentation     |
| `docs/004-AUTHENTICATION.md`   | Auth details          |
| `docs/005-DATABASE_SCHEMA.md`  | Data model            |
| `docs/006-TESTING.md`          | Test guide            |
| `docs/007-DEPLOYMENT.md`       | Deployment            |

## Questions?

Feel free to:

- Open an issue for questions
- Start a discussion for broader topics
- Reach out to maintainers
