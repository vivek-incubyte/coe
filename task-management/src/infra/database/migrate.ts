import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), {
    migrationsFolder: './src/infra/database/migrations',
  });
  await client.end();

  console.log('Migrations applied');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
