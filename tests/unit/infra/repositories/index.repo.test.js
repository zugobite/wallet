import { describe, it, expect } from "vitest";
import * as repos from "../../../../src/infra/repositories/index.mjs";

describe("Repository Index", () => {
    it("should export all repositories", () => {
       expect(repos.userRepo).toBeDefined();
       expect(repos.accountRepo).toBeDefined();
       expect(repos.walletRepo).toBeDefined();
       expect(repos.transactionRepo).toBeDefined();
       expect(repos.ledgerRepo).toBeDefined();
    });
});
