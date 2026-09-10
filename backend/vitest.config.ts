export default {
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    // Run test files sequentially in a single fork to prevent cross-file DB interference
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
};
