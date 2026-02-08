/**
 * @fileoverview Core transaction routes for the wallet API.
 * 
 * Provides endpoints for:
 * - authorize: Create pending authorization (two-phase debit - phase 1)
 * - debit: Execute immediate debit
 * - credit: Execute immediate credit
 * - reverse: Cancel/reverse an authorized transaction
 * 
 * All routes require authentication and apply idempotency checks
 * (except reverse, which has its own idempotency logic).
 * 
 * @module routes
 */

import express from "express";
import authorize from "./handlers/authorize.mjs";
import debit from "./handlers/debit.mjs";
import credit from "./handlers/credit.mjs";
import reverse from "./handlers/reverse.mjs";
import { processBatch } from "./handlers/batch.mjs";
import auth from "./middleware/auth.mjs";
import signature from "./middleware/signature.mjs";
import { idempotency } from "./middleware/idempotency.mjs";
import { transactionLimiter } from "./middleware/rateLimit.mjs";

const router = express.Router();

// All transaction routes require authentication
router.use(auth);

// Apply rate limiting for transaction endpoints
router.use(transactionLimiter);

// Apply signature verification for request integrity (optional - can be enabled per environment)
// Uncomment to enable: router.use(signature);

router.post("/authorize", idempotency, authorize);
router.post("/debit", idempotency, debit);
router.post("/credit", idempotency, credit);
// Reverse endpoint handles its own idempotency (checks if already reversed)
router.post("/reverse", reverse);
// Batch transactions endpoint
router.post("/batch", processBatch);

export default router;
