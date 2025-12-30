/** @type {import('jest').Config} */
const config = {
  // Use ES modules
  testEnvironment: "node",
  
  // Transform settings for ES modules
  transform: {},
  
  // File extensions to consider
  moduleFileExtensions: ["js", "mjs", "json"],
  
  // Test file patterns
  testMatch: [
    "**/tests/**/*.test.js",
    "**/tests/**/*.test.mjs",
  ],
  
  // Ignore patterns - ignore generated Prisma client
  transformIgnorePatterns: [
    "node_modules/",
    "src/generated/",
  ],
  
  // Module path ignore patterns
  modulePathIgnorePatterns: [
    "<rootDir>/src/generated/",
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.{js,mjs}",
    "!src/**/*.d.ts",
    "!src/generated/**",     // Exclude generated files
    "!src/infra/prisma.mjs", // Exclude Prisma client setup
    "!src/infra/redis.mjs",  // Exclude Redis client setup
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // Coverage report formats
  coverageReporters: ["text", "lcov", "html"],
  
  // Coverage output directory
  coverageDirectory: "coverage",
  
  // Setup files
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  
  // Module name mapping for path aliases
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  
  // Verbose output
  verbose: true,
  
  // Test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true,
};

export default config;
