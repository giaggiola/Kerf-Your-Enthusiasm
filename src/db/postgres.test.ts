import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { loadEnvConfig } from '@next/env';
import { eq } from 'drizzle-orm';
import { accounts, cuts, projects, projectStepFiles, sessions, stocks, users } from './schema';

loadEnvConfig(process.cwd());

test('PostgreSQL persistence and authentication', async (t) => {
  const { db, databaseClient } = await import('./index');
  const userId = randomUUID();
  const loginUsername = `test_${userId.slice(0, 8)}`;
  let projectId = '';

  try {
    await db.insert(users).values({
      id: userId,
      email: `postgres-test-${userId}@example.invalid`,
      name: 'PostgreSQL test',
      emailVerified: true,
      username: loginUsername,
    });

    await t.test('project relations preserve dimensions, booleans, JSON, and timestamps', async () => {
      const createdAt = new Date('2026-01-02T03:04:05.678Z');
      const [project] = await db.insert(projects).values({
        userId,
        name: 'Metric cabinet',
        kerf: 3.175,
        units: 'mm',
        layoutHasActive: true,
        layoutOverrides: JSON.stringify({ panel: { x: 12.25, y: 0 } }),
        createdAt,
      }).returning();
      projectId = project.id;

      await db.insert(stocks).values({
        projectId, name: 'Plywood', length: 2440.125, width: 1220.25, thickness: 18.75,
      });
      await db.insert(cuts).values({
        projectId, label: 'Side', length: 600.125, width: 400.25, thickness: 18.75,
      });
      await db.insert(projectStepFiles).values({
        projectId, filename: 'cabinet.step', storagePath: 'test-only/cabinet.step',
      });

      const saved = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: { stocks: true, cuts: true, stepFiles: true },
      });
      assert.ok(saved);
      assert.equal(saved.kerf, 3.175);
      assert.equal(saved.layoutHasActive, true);
      assert.equal(saved.isPublic, false);
      assert.equal(saved.createdAt.toISOString(), createdAt.toISOString());
      assert.deepEqual(JSON.parse(saved.layoutOverrides!), { panel: { x: 12.25, y: 0 } });
      assert.equal(saved.stocks[0].length, 2440.125);
      assert.equal(saved.cuts[0].thickness, 18.75);
      assert.equal(saved.stepFiles[0].filename, 'cabinet.step');

      const [updated] = await db.update(projects).set({
        name: 'Updated cabinet', layoutHasActive: false,
      }).where(eq(projects.id, projectId)).returning();
      assert.equal(updated.name, 'Updated cabinet');
      assert.equal(updated.layoutHasActive, false);
    });

    await t.test('foreign keys reject orphaned project data', async () => {
      await assert.rejects(
        db.insert(cuts).values({ projectId: randomUUID(), label: 'Orphan', length: 10, width: 10 }),
        (error: unknown) => (error as { cause?: { code?: string } }).cause?.code === '23503',
      );
    });

    await t.test('Better Auth can store and retrieve a PostgreSQL session', async () => {
      const { auth } = await import('../lib/auth');
      const { internalAdapter } = await auth.$context;
      const created = await internalAdapter.createSession(userId);
      const saved = await internalAdapter.findSession(created.token);
      assert.ok(saved);
      assert.equal(saved.user.id, userId);
      assert.equal(saved.user.emailVerified, true);
      assert.ok(saved.session.expiresAt instanceof Date);
      assert.ok(saved.session.expiresAt.getTime() > Date.now());
    });

    await t.test('username login accepts a correct password and rejects a wrong one', async () => {
      const { auth } = await import('../lib/auth');
      const context = await auth.$context;
      const password = randomUUID();
      await db.insert(accounts).values({
        id: randomUUID(), userId, providerId: 'credential', accountId: userId,
        password: await context.password.hash(password),
      });
      const result = await auth.api.signInUsername({ body: { username: loginUsername.toUpperCase(), password } });
      assert.equal(result.user.id, userId);
      await assert.rejects(
        auth.api.signInUsername({ body: { username: loginUsername, password: 'incorrect-password' } }),
        (error: unknown) => (error as { statusCode?: number }).statusCode === 401,
      );
    });

    await t.test('public signup is disabled', async () => {
      await assert.rejects(
        (await import('../lib/auth')).auth.api.signUpEmail({
          body: { name: 'Closed signup', email: `closed-${userId}@example.invalid`, password: randomUUID() },
        }),
        (error: unknown) => (error as { statusCode?: number }).statusCode === 400,
      );
      assert.equal(await db.query.users.findFirst({ where: eq(users.email, `closed-${userId}@example.invalid`) }), undefined);
    });

    await t.test('deleting a user cascades to projects, parts, STEP metadata, and sessions', async () => {
      await db.delete(users).where(eq(users.id, userId));
      assert.equal(await db.query.projects.findFirst({ where: eq(projects.id, projectId) }), undefined);
      assert.deepEqual(await db.select().from(stocks).where(eq(stocks.projectId, projectId)), []);
      assert.deepEqual(await db.select().from(cuts).where(eq(cuts.projectId, projectId)), []);
      assert.deepEqual(await db.select().from(projectStepFiles).where(eq(projectStepFiles.projectId, projectId)), []);
      assert.deepEqual(await db.select().from(sessions).where(eq(sessions.userId, userId)), []);
    });
  } finally {
    try {
      await db.delete(users).where(eq(users.id, userId));
    } finally {
      await databaseClient.end();
    }
  }
});
