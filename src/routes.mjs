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
import auth from "./middleware/auth.mjs";
import signature from "./middleware/signature.mjs";
import { idempotency } from "./middleware/idempotency.mjs";

const router = express.Router();

// All transaction routes require authentication
router.use(auth);

// Apply signature verification for request integrity (optional - can be enabled per environment)
// Uncomment to enable: router.use(signature);

/**
 * @swagger
 * components:
 *   schemas:
 *     TransactionRequest:
 *       type: "object"
 *       required:
 *         - walletId
 *         - amount
 *         - referenceId
 *       properties:
 *         walletId:
 *           type: "string"
 *           format: "uuid"
 *           description: "ID of the wallet"
 *         amount:
 *           type: "integer"
 *           description: "Amount in minor units (e.g., cents)"
 *           minimum: 1
 *         referenceId:
 *           type: "string"
 *           description: "Unique reference ID for idempotency"
 *     TransactionResponse:
 *       type: "object"
 *       properties:
 *         status:
 *           type: "integer"
 *           example: 201
 *         code:
 *           type: "string"
 *           example: "CREATED"
 *         data:
 *           $ref: "#/components/schemas/Transaction"
 * 
 * /transactions/authorize:
 *   post:
 *     summary: "Authorize a debit transaction (Phase 1 of 2)"
 *     description: "Creates a pending authorization that reserves funds in the wallet without immediately debiting."
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/TransactionRequest"
 *     responses:
 *       201:
 *         description: "Authorization created successfully"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TransactionResponse"
 *       400:
 *         description: "Bad Request - Missing or invalid fields"
 *       401:
 *         description: "Unauthorized"
 *       404:
 *         description: "Wallet not found"
 *       422:
 *         description: "Insufficient funds"
 * 
 * /transactions/debit:
 *   post:
 *     summary: "Execute an immediate debit"
 *     description: "Immediately debits funds from the wallet."
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/TransactionRequest"
 *     responses:
 *       201:
 *         description: "Debit successful"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TransactionResponse"
 *       422:
 *         description: "Insufficient funds"
 * 
 * /transactions/credit:
 *   post:
 *     summary: "Execute an immediate credit"
 *     description: "Immediately adds funds to the wallet."
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/TransactionRequest"
 *     responses:
 *       201:
 *         description: "Credit successful"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TransactionResponse"
 * 
 * /transactions/reverse:
 *   post:
 *     summary: "Reverse a transaction"
 *     description: "Cancels a pending authorization or reverses a completed transaction."
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: "object"
 *             required:
 *               - transactionId
 *             properties:
 *               transactionId:
 *                 type: "string"
 *                 format: "uuid"
 *                 description: "ID of the transaction to reverse"
 *     responses:
 *       200:
 *         description: "Transaction reversed successfully"
 *       404:
 *         description: "Transaction not found"
 */

router.post("/authorize", idempotency, authorize);
router.post("/debit", idempotency, debit);
router.post("/credit", idempotency, credit);
// Reverse endpoint handles its own idempotency (checks if already reversed)
router.post("/reverse", reverse);

export default router;
