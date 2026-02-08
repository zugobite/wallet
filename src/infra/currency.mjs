/**
 * @fileoverview Multi-currency support utilities using monetra's Converter.
 * 
 * Provides currency conversion, exchange rate management, and multi-currency
 * transaction support.
 * 
 * @module infra/currency
 */

import { money, Converter } from "monetra";
import logger from "./logger.mjs";
import { redis } from "./redis.mjs";

/**
 * Supported currencies
 */
export const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "SEK", "NZD"
];

/**
 * Get exchange rates from cache or external API
 * @param {string} baseCurrency - Base currency code
 * @returns {Promise<object>} Exchange rates object
 */
export async function getExchangeRates(baseCurrency = "USD") {
  const cacheKey = `exchange_rates:${baseCurrency}`;
  
  // Try to get from cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // In production, fetch from external API (e.g., exchangerate-api.com, openexchangerates.org)
  // For now, use mock rates
  const rates = getMockExchangeRates(baseCurrency);

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(rates));

  return rates;
}

/**
 * Mock exchange rates (replace with real API in production)
 * @param {string} baseCurrency - Base currency
 * @returns {object} Exchange rates
 */
function getMockExchangeRates(baseCurrency) {
  // Mock rates relative to USD
  const usdRates = {
    USD: 1.0,
    EUR: 0.85,
    GBP: 0.73,
    JPY: 110.0,
    AUD: 1.35,
    CAD: 1.25,
    CHF: 0.92,
    CNY: 6.45,
    SEK: 8.5,
    NZD: 1.42,
  };

  if (baseCurrency === "USD") {
    return usdRates;
  }

  // Convert rates to new base
  const baseRate = usdRates[baseCurrency];
  const rates = {};
  
  for (const [currency, rate] of Object.entries(usdRates)) {
    rates[currency] = rate / baseRate;
  }

  return rates;
}

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount in minor units
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {Promise<number>} Converted amount in minor units
 */
export async function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  if (!SUPPORTED_CURRENCIES.includes(fromCurrency) || !SUPPORTED_CURRENCIES.includes(toCurrency)) {
    throw new Error(`Unsupported currency: ${fromCurrency} or ${toCurrency}`);
  }

  try {
    const rates = await getExchangeRates(fromCurrency);
    const rate = rates[toCurrency];

    if (!rate) {
      throw new Error(`Exchange rate not found for ${fromCurrency}/${toCurrency}`);
    }

    const amountMoney = money(amount, fromCurrency);
    const converter = new Converter(rates);
    const converted = converter.convert(amountMoney, toCurrency);

    logger.debug({
      amount,
      fromCurrency,
      toCurrency,
      rate,
      convertedAmount: Number(converted.minor),
    }, "Currency conversion performed");

    return Number(converted.minor);
  } catch (error) {
    logger.error({
      error: error.message,
      amount,
      fromCurrency,
      toCurrency,
    }, "Currency conversion failed");
    throw error;
  }
}

/**
 * Validate currency code
 * @param {string} currency - Currency code
 * @returns {boolean} True if valid
 */
export function isValidCurrency(currency) {
  return SUPPORTED_CURRENCIES.includes(currency);
}

/**
 * Format money amount with currency symbol
 * @param {number} amount - Amount in minor units
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
export function formatMoney(amount, currency) {
  const amountMoney = money(amount, currency);
  const majorUnits = Number(amountMoney.minor) / 100;

  const symbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    AUD: "A$",
    CAD: "C$",
    CHF: "CHF",
    CNY: "¥",
    SEK: "kr",
    NZD: "NZ$",
  };

  const symbol = symbols[currency] || currency;
  
  return `${symbol}${majorUnits.toFixed(2)}`;
}
