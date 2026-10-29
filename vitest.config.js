import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.js', 'apps/*/test/**/*.test.js', 'mock-services/test/**/*.test.js'],
    environment: 'node',
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
  },
});