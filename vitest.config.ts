import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

// Board Dashboard test suite (#A30) needs DATABASE_URL — Next.js loads .env automatically but
// Vitest doesn't, so this loads it the same way (empty prefix = load every var, not just VITE_*).
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    test: {
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
