import express from "express";
import authorize from "./handlers/authorize.mjs";
import debit from "./handlers/debit.mjs";
import credit from "./handlers/credit.mjs";
import reverse from "./handlers/reverse.mjs";
import auth from "./middleware/auth.mjs";
import { idempotency } from "./middleware/idempotency.mjs";

const router = express.Router();

router.use(auth);

router.post("/authorize", idempotency, authorize);
router.post("/debit", idempotency, debit);
router.post("/credit", idempotency, credit);
router.post("/reverse", idempotency, reverse);

export default router;
