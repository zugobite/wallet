/**
 * @fileoverview Canonical JSON serialization utility.
 * Provides deterministic JSON serialization by sorting object keys alphabetically.
 * Used for cryptographic operations where consistent byte representation is required.
 */

/**
 * Convert an object to canonical JSON format.
 * 
 * Creates a deterministic JSON string representation by sorting all keys
 * alphabetically before serialization. This ensures that the same object
 * always produces the same JSON string, which is critical for:
 * - HMAC signature verification
 * - Cache key generation
 * - Cryptographic hash computation
 * 
 * @param {Object|null|undefined} obj - The object to serialize
 * @returns {string} Canonical JSON string, or empty string if input is null/undefined/non-object
 * 
 * @example
 * canonicalJson({ z: 1, a: 2 })
 * // Returns: '{"a":2,"z":1}'
 * 
 * @example
 * canonicalJson(null)
 * // Returns: ''
 */
export function canonicalJson(obj) {
  if (!obj || typeof obj !== "object") return "";

  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});

  return JSON.stringify(sorted);
}
