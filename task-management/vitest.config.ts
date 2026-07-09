import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    include: ['__tests__/**/*.spec.ts', '__tests__/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Repository integration tests share one real Postgres DB and truncate
    // tables in beforeEach; running files in parallel races across the
    // tasks<->users FK (e.g. a users truncate cascades userId to null on a
    // task another file is mid-assertion on).
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
    {
      name: 'disable-oxc',
      config: () => ({ oxc: false }),
    },
  ],
});
