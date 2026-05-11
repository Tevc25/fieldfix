import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Run tests serially — SQLite in-memory, but still safer
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
