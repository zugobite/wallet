import express from "express";
import {
  listUsers,
  listWallets,
  listTransactions,
  freezeWallet,
  unfreezeWallet,
  reverseTransaction,
} from "../handlers/admin/index.mjs";
import auth from "../middleware/auth.mjs";
import { requireAdmin } from "../middleware/rbac.mjs";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth);
router.use(requireAdmin);

// Oversight endpoints
router.get("/users", listUsers);
router.get("/wallets", listWallets);
router.get("/transactions", listTransactions);

// Control endpoints
router.post("/wallets/:id/freeze", freezeWallet);
router.post("/wallets/:id/unfreeze", unfreezeWallet);
router.post("/transactions/:id/reverse", reverseTransaction);

export default router;
