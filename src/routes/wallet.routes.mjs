import express from "express";
import {
  getWallet,
  getBalance,
  getTransactions,
  deposit,
  withdraw,
} from "../handlers/wallets/index.mjs";
import auth from "../middleware/auth.mjs";
import { idempotency } from "../middleware/idempotency.mjs";

const router = express.Router();

// All wallet routes require authentication
router.use(auth);

// Read endpoints
router.get("/:id", getWallet);
router.get("/:id/balance", getBalance);
router.get("/:id/transactions", getTransactions);

// Write endpoints with idempotency
router.post("/:id/deposit", idempotency, deposit);
router.post("/:id/withdraw", idempotency, withdraw);

export default router;
