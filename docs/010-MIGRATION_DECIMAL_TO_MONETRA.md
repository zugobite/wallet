# Migration Guide: decimal.js to monetra

## Overview

This document outlines the migration from `decimal.js` to `monetra` v1.2.0 for handling financial calculations in the Wallet Transaction API.

## Why Monetra?

**monetra** is a currency-aware, integer-based money engine designed for financial correctness:

- ❌ **No floating-point arithmetic**: All values stored in minor units (BigInt)
- ❌ **No silent rounding**: Rounding must be explicit
- ❌ **No implicit currency conversion**: Operations between different currencies throw errors
- ✅ **Immutable**: All operations return new objects
- ✅ **Locale-aware formatting**: Built on `Intl` standards
- ✅ **Smart Syntax**: `money()` helper for cleaner code
- ✅ **Multi-Currency Wallets**: Built-in `MoneyBag` for managing portfolios
- ✅ **Currency Conversion**: Robust `Converter` with exchange rate support

## Migration Changes

### Package Dependencies

**Before (decimal.js):**

```json
{
  "dependencies": {
    "decimal.js": "^10.4.3"
  }
}
```

**After (monetra v1.2.0):**

```json
{
  "dependencies": {
    "monetra": "~1.2.0"
  }
}
```

### Import Statements

**Before:**

```javascript
import Decimal from "decimal.js";
```

**After (v1.2.0 - recommended):**

```javascript
import { money } from "monetra";
```

**Alternative (explicit Money class):**

```javascript
import { Money, getCurrency } from "monetra";
```

### Creating Money Objects

**Before (decimal.js):**

```javascript
const balance = new Decimal(wallet.balance).div(100);
const amount = new Decimal(inputAmount).div(100);
```

**After (monetra v1.2.0 with money() helper):**

```javascript
// money() accepts numbers as minor units
const balanceM = money(wallet.balance, wallet.currency);
const amountM = money(amount, wallet.currency);
```

**Alternative (explicit Money.fromMinor):**

```javascript
const currency = getCurrency("USD");
const balanceM = Money.fromMinor(wallet.balance, currency);
const amountM = Money.fromMinor(amount, currency);
```

### Arithmetic Operations

**Before (decimal.js):**

```javascript
const newBalance = balance.add(amount);
const result = balance.sub(amount);
```

**After (monetra):**

```javascript
const newBalanceM = balanceM.add(amountM);
const resultM = balanceM.subtract(amountM);
```

### Comparisons

**Before (decimal.js):**

```javascript
if (balance.lt(amount)) {
  throw new Error("Insufficient funds");
}
```

**After (monetra):**

```javascript
if (balanceM.lessThan(amountM)) {
  throw new Error("Insufficient funds");
}
```

### Converting to Database Values

**Before (decimal.js):**

```javascript
const dbValue = newBalance.mul(100).toNumber();
```

**After (monetra):**

```javascript
const dbValue = Number(newBalanceM.minor);
```

## Available Features in v1.2.0

### Global Helpers

- `money(amount, currency)` - Smart helper (numbers = minor units, strings = major units)
- `getCurrency(code)` - Get currency metadata
- `registerCurrency(currency)` - Register custom currency
- `isCurrencyRegistered(code)` - Check if currency is registered

### Core Money Operations

- `Money.fromMinor(amount, currency)` - Create from minor units (cents)
- `Money.fromMajor(amount, currency)` - Create from major units (dollars)
- `Money.zero(currency)` - Create zero value

### Arithmetic Methods

- `add(other)` - Add money
- `subtract(other)` - Subtract money
- `multiply(multiplier, options)` - Multiply (requires rounding if fractional)
- `allocate(ratios)` - Split money by ratios (e.g., [1, 1, 1])
- `split(parts)` - Split into equal parts
- `percentage(percent)` - Calculate percentage
- `addPercent(percent)` - Add percentage (e.g., tax)
- `subtractPercent(percent)` - Subtract percentage (e.g., discount)

### Comparison Methods

- `lessThan(other)` - Check if less than
- `greaterThan(other)` - Check if greater than
- `equals(other)` - Check if equal
- `isZero()` - Check if zero
- `isNegative()` - Check if negative

### Validation Helpers

- `assertNonNegative(money)` - Throw if negative
- `assertSameCurrency(a, b)` - Throw if currencies differ

### Properties

- `.minor` - Get minor units as BigInt
- `.currency` - Get currency object
- `.format(options)` - Format as string with locale support

### MoneyBag (Multi-Currency Portfolio)

```javascript
import { MoneyBag, money } from "monetra";

const bag = new MoneyBag();
bag.add(money(1000, "USD"));
bag.add(money(500, "EUR"));

console.log(bag.get("USD").format()); // "$10.00"
console.log(bag.get("EUR").format()); // "€5.00"
```

### Converter (Currency Exchange)

```javascript
import { Converter, money } from "monetra";

const converter = new Converter("USD", {
  EUR: 0.85,
  GBP: 0.73,
});

const usd = money(1000, "USD");
const eur = converter.convert(usd, "EUR");
console.log(eur.format()); // "€8.50"
```

## Implementation Examples

### Deposit Operation (v1.2.0)

```javascript
import { money } from "monetra";

export async function deposit({ walletId, accountId, amount, referenceId }) {
  return prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.findWalletByIdAndAccountTx(
      tx,
      walletId,
      accountId
    );

    // Create Money objects with smart syntax
    const balanceM = money(wallet.balance, wallet.currency);
    const amountM = money(amount, wallet.currency);

    // Perform arithmetic
    const newBalanceM = balanceM.add(amountM);

    // Convert to DB format
    const newBalance = Number(newBalanceM.minor);

    return await walletRepo.updateWalletBalance(tx, wallet, newBalance);
  });
}
```

### Validation with Domain Logic

```javascript
import { money, assertNonNegative } from "monetra";

export function canDebit(wallet, amount) {
  const amountMoney = money(amount, wallet.currency);
  const balanceMoney = money(wallet.balance, wallet.currency);

  if (amountMoney.isNegative() || amountMoney.isZero()) {
    throw new DomainError("Amount must be positive", "INVALID_AMOUNT", 400);
  }

  if (balanceMoney.lessThan(amountMoney)) {
    throw new DomainError("Insufficient funds", "INSUFFICIENT_FUNDS", 422);
  }
}
```

## Testing Considerations

### Mock Data Updates

When using monetra in tests, ensure currency is provided:

**Before:**

```javascript
const wallet = { balance: 1000 };
```

**After:**

```javascript
const wallet = { balance: 1000, currency: "USD" };
```

## Version History

| Version | Features                                                                       |
| ------- | ------------------------------------------------------------------------------ |
| v1.0.1  | `Money.fromMinor()`, `lessThan()`, `greaterThan()`, `isZero()`, `isNegative()` |
| v1.2.0  | `money()` helper, `MoneyBag`, `Converter`, validation helpers, `percentage()`  |

## Performance Notes

- **BigInt operations**: monetra uses `BigInt` for precision, which is slightly slower than floating-point but guarantees correctness
- **Immutability**: All operations create new objects, but this is negligible in typical transaction volumes
- **Database storage**: Minor units are stored as `Number` after casting from `BigInt`

## Best Practices

1. **Use money() helper**: Prefer `money(amount, currency)` over `Money.fromMinor()`
2. **Always specify currency**: Pass currency code or use wallet's currency
3. **Use explicit rounding**: When multiplying, always provide a rounding mode
4. **Validate inputs**: Check for negative/zero amounts before operations
5. **Test with real scenarios**: Use actual currency values in unit tests
6. **Handle errors**: Catch `CurrencyMismatchError`, `InvalidPrecisionError`, and `RoundingRequiredError`

## References

- [monetra GitHub Repository](https://github.com/zugobite/monetra)
- [monetra npm Package](https://www.npmjs.com/package/monetra)
- [API Reference](https://github.com/zugobite/monetra/blob/main/docs/001-API-REFERENCE.md)
- [Feature Guide](https://github.com/zugobite/monetra/blob/main/docs/002-FEATURE-GUIDE.md)
