export default {
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    // Run test files sequentially in a single fork to prevent cross-file DB interference
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
};
