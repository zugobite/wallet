import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true, // Enable Jest-like globals (describe, it, expect)
    include: ['tests/**/*.test.js', 'tests/**/*.test.mjs'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{js,mjs}'],
      exclude: [
        'src/**/*.d.ts',
        'src/generated/**',
        'src/infra/prisma.mjs',
        'src/infra/redis.mjs',
      ],
      thresholds: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  },
});
