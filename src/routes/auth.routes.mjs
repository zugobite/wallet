import express from "express";
import { register, login, me } from "../handlers/auth/index.mjs";
import auth from "../middleware/auth.mjs";
import { authLimiter } from "../middleware/rateLimit.mjs";

const router = express.Router();

// Public routes (no authentication required) with rate limiting
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

// Protected routes (authentication required)
router.get("/me", auth, me);

export default router;
