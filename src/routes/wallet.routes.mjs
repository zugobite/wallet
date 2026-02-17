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

/**
 * @swagger
 * /wallets/{id}:
 *   get:
 *     summary: Get wallet details
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Wallet ID
 *     responses:
 *       200:
 *         description: Wallet details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 balance:
 *                   type: number
 *                   description: Current balance
 *                 currency:
 *                   type: string
 *                   example: USD
 *       404:
 *         description: Wallet not found
 *
 * /wallets/{id}/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Current balance retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                 currency:
 *                   type: string
 *
 * /wallets/{id}/transactions:
 *   get:
 *     summary: Get transaction history
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *
 * /wallets/{id}/deposit:
 *   post:
 *     summary: Deposit funds to wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - referenceId
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *               referenceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deposit successful
 *
 * /wallets/{id}/withdraw:
 *   post:
 *     summary: Withdraw funds from wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - referenceId
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *               referenceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Withdrawal successful
 *       422:
 *         description: Insufficient funds
 */

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
