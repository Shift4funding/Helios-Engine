import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // No setupFiles for unit tests - clean slate
    setupFiles: [],
    testTimeout: 30000,
    hookTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret',
      MONGODB_URI: 'mongodb://localhost:27017/test',
      REDIS_URL: 'redis://localhost:6379',
      REDIS_MOCK: 'true',
      USE_REDIS: 'false',
      PERPLEXITY_API_KEY: 'test-perplexity-key',
      ZOHO_CLIENT_ID: 'test-zoho-id',
      ZOHO_CLIENT_SECRET: 'test-zoho-secret',
      ZOHO_REFRESH_TOKEN: 'test-zoho-refresh'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
