// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: [
    'src/**/*.mjs',
    'src/**/*.js',
    '!src/generated/**/*.ts', // Exclude generated files
    '!src/generated/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.test.mjs',
  ],
  vitest: {
    configFile: 'vitest.config.mjs',
  },
};
