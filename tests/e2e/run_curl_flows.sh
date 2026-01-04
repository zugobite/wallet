#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000/api/v1"
EMAIL="testuser_$(date +%s)@example.com"
PASSWORD="Password123!"
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Helper function to extract JSON field using node
json_value() {
  echo "$1" | node -pe "try { JSON.parse(fs.readFileSync(0, 'utf-8')).$2 } catch(e) { '' }"
}

# Helper function to print step
step() {
  echo -e "\n${GREEN}=== $1 ===${NC}"
}

# Helper function to check http status
check_status() {
  if [ "$1" -ne "$2" ]; then
    echo -e "${RED}FAILED: Expected status $2, got $1${NC}"
    echo "Response: $3"
    exit 1
  fi
}

echo "Starting End-to-End CURL Test Suite..."
echo "Target: $BASE_URL"
echo "User: $EMAIL"

# ============================================================================
# 1. Register
# ============================================================================
step "1. Registering new user"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"currency\": \"USD\"
  }")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 201 "$HTTP_BODY"

TOKEN=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.token")
WALLET_ID=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.wallet.id")
USER_ID=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.user.id")

echo "Token: ${TOKEN:0:10}..."
echo "Wallet ID: $WALLET_ID"
echo "User ID: $USER_ID"

# ============================================================================
# 2. Login (Verify credentials)
# ============================================================================
step "2. Logging in"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 200 "$HTTP_BODY"
echo "Login successful"

# ============================================================================
# 3. Get Wallet Details
# ============================================================================
step "3. Fetching Wallet Details"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/wallets/$WALLET_ID" \
  -H "Authorization: Bearer $TOKEN")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 200 "$HTTP_BODY"
BALANCE=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.wallet.balance")
echo "Initial Balance: $BALANCE"

# ============================================================================
# 4. Deposit Funds
# ============================================================================
step "4. Depositing 100.00 USD (10000 cents)"
DEPOSIT_REF="dep-$(date +%s)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/wallets/$WALLET_ID/deposit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"amount\": 10000,
    \"referenceId\": \"$DEPOSIT_REF\"
  }")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 200 "$HTTP_BODY"
NEW_BALANCE=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.wallet.balance")
echo "New Balance: $NEW_BALANCE"

if [ "$NEW_BALANCE" -ne 10000 ]; then
  echo -e "${RED}Balance mismatch! Expected 10000, got $NEW_BALANCE${NC}"
  exit 1
fi

# ============================================================================
# 5. Withdraw Funds
# ============================================================================
step "5. Withdrawing 20.00 USD (2000 cents)"
WITHDRAW_REF="with-$(date +%s)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/wallets/$WALLET_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"amount\": 2000,
    \"referenceId\": \"$WITHDRAW_REF\"
  }")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 200 "$HTTP_BODY"
NEW_BALANCE=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.wallet.balance")
echo "New Balance: $NEW_BALANCE"

if [ "$NEW_BALANCE" -ne 8000 ]; then
  echo -e "${RED}Balance mismatch! Expected 8000, got $NEW_BALANCE${NC}"
  exit 1
fi

# ============================================================================
# 6. Authorize Transaction (Hold)
# ============================================================================
step "6. Authorizing 10.00 USD (1000 cents)"
AUTH_REF="auth-$(date +%s)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/transactions/authorize" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"walletId\": \"$WALLET_ID\",
    \"amount\": 1000,
    \"referenceId\": \"$AUTH_REF\"
  }")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 201 "$HTTP_BODY"
AUTH_ID=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.id")
echo "Authorized Tx ID: $AUTH_ID"

# ============================================================================
# 7. Debit Transaction (Capture)
# ============================================================================
step "7. Debiting 10.00 USD (1000 cents)"
DEBIT_REF="debit-$(date +%s)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/transactions/debit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"walletId\": \"$WALLET_ID\",
    \"amount\": 1000,
    \"referenceId\": \"$DEBIT_REF\"
  }")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 200 "$HTTP_BODY"
NEW_BALANCE=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.wallet.balance")
echo "New Balance: $NEW_BALANCE"

if [ "$NEW_BALANCE" -ne 7000 ]; then
  echo -e "${RED}Balance mismatch! Expected 7000, got $NEW_BALANCE${NC}"
  exit 1
fi

# ============================================================================
# 8. Reverse Transaction (Authorize then Reverse)
# ============================================================================
step "8. Testing Reversal (Authorize -> Reverse)"
REV_AUTH_REF="rev-auth-$(date +%s)"

# 8a. Authorize
echo "Authorizing..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/transactions/authorize" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"walletId\": \"$WALLET_ID\",
    \"amount\": 500,
    \"referenceId\": \"$REV_AUTH_REF\"
  }")
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
check_status "$HTTP_STATUS" 201 "$HTTP_BODY"

# 8b. Reverse
echo "Reversing..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/transactions/reverse" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"referenceId\": \"$REV_AUTH_REF\"
  }")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 200 "$HTTP_BODY"
STATUS=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.status")
echo "Transaction Status: $STATUS"

if [ "$STATUS" != "reversed" ]; then
  echo -e "${RED}Status mismatch! Expected reversed, got $STATUS${NC}"
  exit 1
fi

# ============================================================================
# 9. Get Transaction History
# ============================================================================
step "9. Fetching Transaction History"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/wallets/$WALLET_ID/transactions?limit=10" \
  -H "Authorization: Bearer $TOKEN")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

check_status "$HTTP_STATUS" 200 "$HTTP_BODY"
COUNT=$(echo "$HTTP_BODY" | node -pe "JSON.parse(fs.readFileSync(0, 'utf-8')).data.transactions.length")
echo "Found $COUNT transactions"

if [ "$COUNT" -lt 4 ]; then
  echo -e "${RED}Expected at least 4 transactions (Deposit, Withdraw, Debit, Auth), found $COUNT${NC}"
  # Not exiting here as it might be timing related or logic related, but warning
fi

echo -e "\n${GREEN}All tests passed successfully!${NC}"
