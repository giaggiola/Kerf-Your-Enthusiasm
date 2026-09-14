import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it to the Coolify PostgreSQL connection URL.');
}

// Reuse connections across Next.js development reloads.
const globalDatabase = globalThis as typeof globalThis & {
  kerfPostgres?: ReturnType<typeof postgres>;
};

export const databaseClient = globalDatabase.kerfPostgres ?? postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') {
  globalDatabase.kerfPostgres = databaseClient;
}

export const db = drizzle(databaseClient, { schema });
