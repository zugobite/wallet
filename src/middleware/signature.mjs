/**
 * @fileoverview Request signature verification middleware.
 * Validates HMAC-SHA256 signatures on incoming requests to ensure authenticity
 * and prevent tampering. Includes timestamp validation and replay attack protection.
 */

import crypto from "crypto";
import { canonicalJson } from "../utils/canonicalJson.mjs";
import { redis } from "../infra/redis.mjs";

/**
 * Request signature verification middleware.
 * 
 * Validates that the request has a valid HMAC-SHA256 signature computed from:
 * - Request method (uppercase)
 * - Request URL path
 * - Timestamp
 * - Nonce (unique identifier)
 * - Canonical JSON representation of request body
 * 
 * Security features:
 * - Timestamp validation: Rejects requests older than configured TTL
 * - Nonce tracking: Prevents replay attacks using Redis cache
 * - Constant-time comparison: Protects against timing attacks
 * 
 * Required headers:
 * - x-signature: HMAC-SHA256 signature (hex-encoded)
 * - x-signature-version: Signature version (currently "v1")
 * - x-timestamp: Unix timestamp in milliseconds
 * - x-nonce: Unique request identifier
 * 
 * @async
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Request headers
 * @param {string} req.headers["x-signature"] - HMAC signature of request
 * @param {string} req.headers["x-signature-version"] - Signature version
 * @param {string} req.headers["x-timestamp"] - Request timestamp (ms)
 * @param {string} req.headers["x-nonce"] - Unique nonce for replay prevention
 * @param {string} req.method - HTTP method
 * @param {string} req.originalUrl - Full request URL
 * @param {Object} req.body - Request body
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>} Calls next() if signature valid, or sends error response
 * @throws {401} UNAUTHORIZED - Missing signature headers
 * @throws {401} UNAUTHORIZED - Unsupported signature version
 * @throws {401} UNAUTHORIZED - Request expired (timestamp too old)
 * @throws {401} UNAUTHORIZED - Replay detected (nonce already used)
 * @throws {401} UNAUTHORIZED - Invalid signature
 */
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
