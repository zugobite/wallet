import rateLimit from "express-rate-limit";
import logger from "../infra/logger.mjs";

/**
 * Rate limiter for general API endpoints
 * Prevents abuse by limiting requests per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    status: "error",
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn({
      msg: "Rate limit exceeded",
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      status: "error",
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this IP, please try again later.",
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login/registration
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    status: "error",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    message:
      "Too many authentication attempts from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      msg: "Auth rate limit exceeded",
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      status: "error",
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message:
        "Too many authentication attempts from this IP, please try again later.",
    });
  },
});

/**
 * Transaction rate limiter
 * Prevents rapid transaction submissions
 */
export const transactionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 transactions per minute
  message: {
    status: "error",
    code: "TRANSACTION_RATE_LIMIT_EXCEEDED",
    message: "Too many transactions, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      msg: "Transaction rate limit exceeded",
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });
    res.status(429).json({
      status: "error",
      code: "TRANSACTION_RATE_LIMIT_EXCEEDED",
      message: "Too many transactions, please slow down.",
    });
  },
});
