import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './src/infra/database/migrations',
  schema: './src/infra/database/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
