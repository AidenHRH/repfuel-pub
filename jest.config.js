// Run every test in the owner's time zone so day boundaries and clock changes are deterministic.
process.env.TZ = 'Europe/London';

module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
  // App tests render the whole router; the first in each file also loads every screen. GitHub's runners are
  // several times slower than a laptop, so 5 s (Jest's default) isn't enough headroom there.
  testTimeout: 15000,
  setupFiles: ['react-native-gesture-handler/jestSetup', '<rootDir>/tests/setup.ts'],
  // Reanimated 4 / Worklets ship a resolver that swaps native-only modules for their JS versions.
  resolver: 'react-native-reanimated/jest/resolver',
};
