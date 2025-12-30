import crypto from "crypto";
import { canonicalJson } from "../utlis/canonicalJson.mjs";
import { redis } from "../infra/redis.mjs";

export default async function signature(req, res, next) {
  const {
    "x-signature": signature,
    "x-signature-version": version,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
  } = req.headers;

  if (!signature || !version || !timestamp || !nonce) {
    return res.status(401).json({ error: "Missing signature headers" });
  }

  if (version !== "v1") {
    return res.status(401).json({ error: "Unsupported signature version" });
  }

  const now = Date.now();
  const ttl = Number(process.env.SIGNATURE_TTL_MS);

  if (Math.abs(now - Number(timestamp)) > ttl) {
    return res.status(401).json({ error: "Request expired" });
  }

  // 🔒 Replay protection
  const nonceKey = `nonce:${nonce}`;
  const seen = await redis.get(nonceKey);

  if (seen) {
    return res.status(401).json({ error: "Replay detected" });
  }

  await redis.set(nonceKey, "1", "PX", ttl);

  const payload = [
    req.method.toUpperCase(),
    req.originalUrl,
    timestamp,
    nonce,
    canonicalJson(req.body),
  ].join("|");

  const expected = crypto
    .createHmac("sha256", process.env.REQUEST_SIGNING_SECRET)
    .update(payload)
    .digest();

  const provided = Buffer.from(signature, "hex");

  // Constant-time comparison
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  next();
}
