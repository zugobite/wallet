/**
 * @fileoverview Currency conversion and exchange rate handlers.
 * 
 * @module handlers/currency
 */

import { StatusCodes } from "http-status-codes";
import logger from "../infra/logger.mjs";
import {
  SUPPORTED_CURRENCIES,
  getExchangeRates,
  convertCurrency,
  formatMoney,
} from "../infra/currency.mjs";

/**
 * GET /api/v1/currency/rates
 * Get current exchange rates
 */
export async function getRates(req, res) {
  try {
    const { base = "USD" } = req.query;

    if (!SUPPORTED_CURRENCIES.includes(base)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_CURRENCY",
        message: `Unsupported base currency: ${base}`,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      });
    }

    const rates = await getExchangeRates(base);

    return res.status(StatusCodes.OK).json({
      status: "success",
      code: "OK",
      data: {
        base,
        rates,
        supportedCurrencies: SUPPORTED_CURRENCIES,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
    }, "Failed to get exchange rates");

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Failed to get exchange rates",
    });
  }
}

/**
 * POST /api/v1/currency/convert
 * Convert amount between currencies
 */
export async function convert(req, res) {
  try {
    const { amount, from, to } = req.body;

    // Validation
    if (!amount || !Number.isInteger(amount) || amount <= 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_AMOUNT",
        message: "amount must be a positive integer (minor units)",
      });
    }

    if (!from || !SUPPORTED_CURRENCIES.includes(from)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_CURRENCY",
        message: `Invalid source currency: ${from}`,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      });
    }

    if (!to || !SUPPORTED_CURRENCIES.includes(to)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        code: "INVALID_CURRENCY",
        message: `Invalid target currency: ${to}`,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      });
    }

    const convertedAmount = await convertCurrency(amount, from, to);

    return res.status(StatusCodes.OK).json({
      status: "success",
      code: "OK",
      data: {
        from: {
          currency: from,
          amount,
          formatted: formatMoney(amount, from),
        },
        to: {
          currency: to,
          amount: convertedAmount,
          formatted: formatMoney(convertedAmount, to),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      body: req.body,
    }, "Currency conversion failed");

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Currency conversion failed",
    });
  }
}

/**
 * GET /api/v1/currency/supported
 * List supported currencies
 */
export async function getSupportedCurrencies(req, res) {
  return res.status(StatusCodes.OK).json({
    status: "success",
    code: "OK",
    data: {
      currencies: SUPPORTED_CURRENCIES,
      count: SUPPORTED_CURRENCIES.length,
    },
  });
}
