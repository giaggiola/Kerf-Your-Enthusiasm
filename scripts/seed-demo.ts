import { randomUUID } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import { eq } from 'drizzle-orm';
import { cuts, projects, stocks, users } from '../src/db/schema';
import { DEVELOPMENT_EMAIL } from '../src/lib/development';
import { partFromStorage, validateDocument } from '../src/features/cut-lists/domain/parts';
import { demoLists } from './demo-data';

async function main() {
  loadEnvConfig(process.cwd(), true);
  if ((process.env.NODE_ENV ?? 'development') !== 'development' || process.env.ENABLE_DEV_LOGIN !== 'true') {
    throw new Error('Demo data requires development mode and ENABLE_DEV_LOGIN=true.');
  }

  const { db, databaseClient } = await import('../src/db');
  try {
    const results = await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: randomUUID(), email: DEVELOPMENT_EMAIL, name: 'Development', emailVerified: true,
      }).onConflictDoNothing({ target: users.email });
      const user = await tx.query.users.findFirst({ where: eq(users.email, DEVELOPMENT_EMAIL) });
      if (!user) throw new Error('Could not find the development account.');

      const results: string[] = [];
      for (const [index, list] of demoLists.entries()) {
        const parts = list.parts.map(([label, quantity, length, width, thickness, material, groupName], sortOrder) => ({
          id: randomUUID(), projectId: list.id, label, quantity, length, width, thickness, material, groupName, sortOrder,
        }));
        const error = validateDocument({
          name: list.name,
          parts: parts.map((part) => partFromStorage(part, list.units)),
        });
        if (error) throw new Error(`${list.name}: ${error}`);

        // Stagger dates so the library has a predictable, useful starting order.
        const createdAt = new Date(Date.now() - index * 24 * 60 * 60 * 1000);
        const [inserted] = await tx.insert(projects).values({
          id: list.id, userId: user.id, name: list.name, description: list.description,
          units: list.units, kerf: list.kerf, layoutPadding: list.padding,
          createdAt, updatedAt: createdAt,
        }).onConflictDoNothing({ target: projects.id }).returning({ id: projects.id });

        if (!inserted) {
          results.push(`Kept existing: ${list.name}`);
          continue;
        }
        if (parts.length) await tx.insert(cuts).values(parts);
        if (list.stocks.length) {
          await tx.insert(stocks).values(list.stocks.map(([name, quantity, length, width, thickness, material], sortOrder) => ({
            projectId: list.id, name, quantity, length, width, thickness, material, sortOrder,
          })));
        }
        results.push(`Created: ${list.name} (${parts.reduce((sum, part) => sum + part.quantity, 0)} pieces)`);
      }
      return results;
    });
    for (const result of results) console.log(result);
    console.log('Open /cut-list using Development login. Existing sample edits are preserved on rerun.');
  } finally {
    await databaseClient.end();
  }
}

main().catch((error: unknown) => {
  // Database errors can contain connection details and queries; keep those private.
  console.error(error instanceof Error && !('query' in error) ? error.message : 'Could not seed demo data. Check the development database connection and migrations.');
  process.exitCode = 1;
});
