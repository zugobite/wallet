import "dotenv/config";
import { jest, beforeAll, afterAll } from "@jest/globals";

// Extend Jest timeout for database operations
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Setup code here
});

afterAll(async () => {
  // Cleanup code here
});
