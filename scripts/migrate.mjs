import nextEnv from '@next/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for database migrations.');
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL('../src/db/migrations', import.meta.url)),
  });
  console.log('PostgreSQL migrations applied.');
} finally {
  await client.end();
}
