import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.js'],
    setupFiles: './tests/integration/setup.js',
    environment: 'node',
  },
});