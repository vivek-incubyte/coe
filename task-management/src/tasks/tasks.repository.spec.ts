import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../infra/database/schema';
import { tasks } from '../infra/database/schema';
import { TASK_STATUS } from './task.enum';
import { TasksRepository } from './tasks.repository';

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;
let repo: TasksRepository;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set in .env');

  sql = postgres(url, { max: 1 });
  db = drizzle(sql, { schema });

  await migrate(db, { migrationsFolder: 'src/infra/database/migrations' });

  repo = new TasksRepository(db);
}, 30_000);

beforeEach(async () => {
  await db.delete(tasks);
});

afterAll(async () => {
  await sql.end();
});

describe('create', () => {
  // O — One: a single row actually lands in the DB
  it('inserts exactly one row in the database', async () => {
    await repo.create({ title: 'Buy milk' });

    const rows = await db.select().from(tasks);
    expect(rows).toHaveLength(1);
  });

  it('persists the title to the database', async () => {
    await repo.create({ title: 'Buy milk' });

    const [row] = await db.select().from(tasks);
    expect(row.title).toBe('Buy milk');
  });

  it('stores OPEN as the default status when none is provided', async () => {
    await repo.create({ title: 'Default status task' });

    const [row] = await db.select().from(tasks);
    expect(row.status).toBe(TASK_STATUS.OPEN);
  });

  it('stores null for description when none is provided', async () => {
    await repo.create({ title: 'No description' });

    const [row] = await db.select().from(tasks);
    expect(row.description).toBeNull();
  });

  // M — Many: multiple creates produce independent rows
  it('each create call inserts a separate row with a unique id', async () => {
    await repo.create({ title: 'First' });
    await repo.create({ title: 'Second' });

    const rows = await db.select().from(tasks);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  // B — Boundary: edge values persist correctly
  it('persists a single-character title without truncation', async () => {
    await repo.create({ title: 'X' });

    const [row] = await db.select().from(tasks);
    expect(row.title).toBe('X');
  });

  it('persists an explicit description when provided', async () => {
    await repo.create({ title: 'With desc', description: 'Some details' });

    const [row] = await db.select().from(tasks);
    expect(row.description).toBe('Some details');
  });

  it('persists IN_PROGRESS status when explicitly set', async () => {
    await repo.create({ title: 'WIP', status: TASK_STATUS.IN_PROGRESS });

    const [row] = await db.select().from(tasks);
    expect(row.status).toBe(TASK_STATUS.IN_PROGRESS);
  });

  it('persists DONE status when explicitly set', async () => {
    await repo.create({ title: 'Done task', status: TASK_STATUS.DONE });

    const [row] = await db.select().from(tasks);
    expect(row.status).toBe(TASK_STATUS.DONE);
  });

  // I — Interface: the returned task reflects what is actually in the DB
  it('returns a task whose id matches the row stored in the database', async () => {
    const task = await repo.create({ title: 'ID check' });

    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row).toBeDefined();
  });

  it('returns a task whose title matches the persisted row', async () => {
    const task = await repo.create({ title: 'Title round-trip' });

    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(task.title).toBe(row.title);
  });

  // E — Exception: DB-level constraint violations when TypeScript types are bypassed at runtime
  it('throws when title is null (NOT NULL constraint)', async () => {
    await expect(
      repo.create({ title: null as unknown as string }),
    ).rejects.toThrow();
  });

  it('does not insert any row when title is null', async () => {
    await repo.create({ title: null as unknown as string }).catch(() => {});

    const rows = await db.select().from(tasks);
    expect(rows).toHaveLength(0);
  });

  it('throws when status is an invalid enum value', async () => {
    await expect(
      repo.create({ title: 'Valid title', status: 'INVALID_STATUS' as any }),
    ).rejects.toThrow();
  });

  it('does not insert any row when status is an invalid enum value', async () => {
    await repo
      .create({ title: 'Valid title', status: 'INVALID_STATUS' as any })
      .catch(() => {});

    const rows = await db.select().from(tasks);
    expect(rows).toHaveLength(0);
  });
});
