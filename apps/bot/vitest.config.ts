

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    root: __dirname,
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.git/**'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});


