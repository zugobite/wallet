import { describe, it, expect } from "@jest/globals";
import { canonicalJson } from "../../../src/utlis/canonicalJson.mjs";

describe("canonicalJson", () => {
  describe("basic functionality", () => {
    it("should return empty string for null", () => {
      expect(canonicalJson(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(canonicalJson(undefined)).toBe("");
    });

    it("should return empty string for non-object", () => {
      expect(canonicalJson("string")).toBe("");
      expect(canonicalJson(123)).toBe("");
      expect(canonicalJson(true)).toBe("");
    });

    it("should return JSON string for empty object", () => {
      expect(canonicalJson({})).toBe("{}");
    });
  });

  describe("key sorting", () => {
    it("should sort keys alphabetically", () => {
      const obj = { c: 3, a: 1, b: 2 };
      const result = canonicalJson(obj);
      expect(result).toBe('{"a":1,"b":2,"c":3}');
    });

    it("should sort keys with different types", () => {
      const obj = { zebra: "animal", apple: "fruit", banana: "fruit" };
      const result = canonicalJson(obj);
      expect(result).toBe(
        '{"apple":"fruit","banana":"fruit","zebra":"animal"}'
      );
    });

    it("should handle numeric keys", () => {
      const obj = { 2: "two", 1: "one", 3: "three" };
      const result = canonicalJson(obj);
      // Numeric keys are sorted as strings
      expect(result).toBe('{"1":"one","2":"two","3":"three"}');
    });
  });

  describe("value types", () => {
    it("should handle string values", () => {
      const obj = { name: "John" };
      expect(canonicalJson(obj)).toBe('{"name":"John"}');
    });

    it("should handle number values", () => {
      const obj = { age: 30, balance: 1000.5 };
      const result = canonicalJson(obj);
      expect(result).toContain('"age":30');
      expect(result).toContain('"balance":1000.5');
    });

    it("should handle boolean values", () => {
      const obj = { active: true, deleted: false };
      expect(canonicalJson(obj)).toBe('{"active":true,"deleted":false}');
    });

    it("should handle null values", () => {
      const obj = { value: null };
      expect(canonicalJson(obj)).toBe('{"value":null}');
    });

    it("should handle array values", () => {
      const obj = { items: [1, 2, 3] };
      expect(canonicalJson(obj)).toBe('{"items":[1,2,3]}');
    });

    it("should handle nested objects (note: shallow sort only)", () => {
      const obj = { outer: { b: 2, a: 1 } };
      const result = canonicalJson(obj);
      // Note: nested objects are not sorted
      expect(result).toBe('{"outer":{"b":2,"a":1}}');
    });
  });

  describe("real-world scenarios", () => {
    it("should produce consistent output for same data", () => {
      const obj1 = { walletId: "w1", amount: 1000, referenceId: "ref1" };
      const obj2 = { amount: 1000, referenceId: "ref1", walletId: "w1" };

      expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
    });

    it("should produce different output for different data", () => {
      const obj1 = { walletId: "w1", amount: 1000 };
      const obj2 = { walletId: "w1", amount: 2000 };

      expect(canonicalJson(obj1)).not.toBe(canonicalJson(obj2));
    });
  });
});
