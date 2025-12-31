import express from "express";
import { register, login, me } from "../handlers/auth/index.mjs";
import auth from "../middleware/auth.mjs";

const router = express.Router();

// Public routes (no authentication required)
router.post("/register", register);
router.post("/login", login);

// Protected routes (authentication required)
router.get("/me", auth, me);

export default router;
