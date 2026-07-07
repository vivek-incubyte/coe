import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../infra/database/schema';
import { TABLE_TASKS } from '../infra/database/schema';
import { TaskStatus } from './task.schema';
import { TasksRepository } from './tasks.repository';

const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';
const MALFORMED_ID = 'not-a-uuid';

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
  await db.delete(TABLE_TASKS);
});

afterAll(async () => {
  await sql.end();
});

describe('create', () => {
  // O — One: a single row actually lands in the DB
  it('inserts exactly one row in the database', async () => {
    await repo.create({ title: 'Buy milk' });

    const rows = await db.select().from(TABLE_TASKS);
    expect(rows).toHaveLength(1);
  });

  it('persists the title to the database', async () => {
    await repo.create({ title: 'Buy milk' });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.title).toBe('Buy milk');
  });

  it('stores OPEN as the default status when none is provided', async () => {
    await repo.create({ title: 'Default status task' });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.status).toBe(TaskStatus.enum.OPEN);
  });

  it('stores null for description when none is provided', async () => {
    await repo.create({ title: 'No description' });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.description).toBeNull();
  });

  // M — Many: multiple creates produce independent rows
  it('each create call inserts a separate row with a unique id', async () => {
    await repo.create({ title: 'First' });
    await repo.create({ title: 'Second' });

    const rows = await db.select().from(TABLE_TASKS);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  // B — Boundary: edge values persist correctly
  it('persists a single-character title without truncation', async () => {
    await repo.create({ title: 'X' });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.title).toBe('X');
  });

  it('persists an explicit description when provided', async () => {
    await repo.create({ title: 'With desc', description: 'Some details' });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.description).toBe('Some details');
  });

  it('persists IN_PROGRESS status when explicitly set', async () => {
    await repo.create({ title: 'WIP', status: TaskStatus.enum.IN_PROGRESS });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.status).toBe(TaskStatus.enum.IN_PROGRESS);
  });

  it('persists DONE status when explicitly set', async () => {
    await repo.create({ title: 'Done task', status: TaskStatus.enum.DONE });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.status).toBe(TaskStatus.enum.DONE);
  });

  // I — Interface: the returned task reflects what is actually in the DB
  it('returns a task whose id matches the row stored in the database', async () => {
    const task = await repo.create({ title: 'ID check' });

    const [row] = await db
      .select()
      .from(TABLE_TASKS)
      .where(eq(TABLE_TASKS.id, task.id));
    expect(row).toBeDefined();
  });

  it('returns a task whose title matches the persisted row', async () => {
    const task = await repo.create({ title: 'Title round-trip' });

    const [row] = await db
      .select()
      .from(TABLE_TASKS)
      .where(eq(TABLE_TASKS.id, task.id));
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

    const rows = await db.select().from(TABLE_TASKS);
    expect(rows).toHaveLength(0);
  });

  it('throws when status is an invalid enum value', async () => {
    await expect(
      repo.create({
        title: 'Valid title',
        status: 'INVALID_STATUS' as unknown as TaskStatus,
      }),
    ).rejects.toThrow();
  });

  it('does not insert any row when status is an invalid enum value', async () => {
    await repo
      .create({
        title: 'Valid title',
        status: 'INVALID_STATUS' as unknown as TaskStatus,
      })
      .catch(() => {});

    const rows = await db.select().from(TABLE_TASKS);
    expect(rows).toHaveLength(0);
  });
});

describe('findById', () => {
  // Z — Zero: table is empty
  it('returns null when the table has no rows at all', async () => {
    const result = await repo.findById(NON_EXISTENT_ID);
    expect(result).toBeNull();
  });

  // O — One: a single matching row exists
  it('returns the task when exactly one row exists and matches the id', async () => {
    const created = await repo.create({ title: 'Find me' });

    const result = await repo.findById(created.id);
    expect(result?.id).toBe(created.id);
  });

  // M — Many: picks the right row out of several
  it('returns the correct task when multiple rows exist', async () => {
    await repo.create({ title: 'First' });
    const target = await repo.create({ title: 'Target' });
    await repo.create({ title: 'Third' });

    const result = await repo.findById(target.id);
    expect(result?.title).toBe('Target');
  });

  // B — Boundary: well-formed id that simply has no match
  it('returns null for a well-formed uuid that does not exist', async () => {
    await repo.create({ title: 'Some task' });

    const result = await repo.findById(NON_EXISTENT_ID);
    expect(result).toBeNull();
  });

  // I — Interface: the returned task reflects every field of the DB row
  it('returns a task with all fields matching the persisted row', async () => {
    const created = await repo.create({
      title: 'Full round trip',
      description: 'Some details',
      status: TaskStatus.enum.IN_PROGRESS,
    });

    const result = await repo.findById(created.id);

    expect(result).toEqual(created);
  });

  // E — Exception: malformed id is rejected at the DB level
  it('throws when the id is not a valid uuid', async () => {
    await expect(repo.findById(MALFORMED_ID)).rejects.toThrow();
  });
});

describe('findAll', () => {
  // Z — Zero: table is empty
  it('returns an empty array when there are no tasks', async () => {
    const result = await repo.findAll({ limit: 1000, offset: 0 });
    expect(result).toEqual([]);
  });

  // O — One: a single task in the table
  it('returns a single-element array when one task exists', async () => {
    await repo.create({ title: 'Only task' });

    const result = await repo.findAll({ limit: 1000, offset: 0 });
    expect(result).toHaveLength(1);
  });

  // M — Many: multiple tasks in the table
  it('returns every task when multiple exist', async () => {
    await repo.create({ title: 'First' });
    await repo.create({ title: 'Second' });
    await repo.create({ title: 'Third' });

    const result = await repo.findAll({ limit: 1000, offset: 0 });

    expect(result).toHaveLength(3);
    expect(result.map((t) => t.title).sort()).toEqual(
      ['First', 'Second', 'Third'].sort(),
    );
  });

  // B — Boundary: a row with a null description is mapped correctly
  it('maps a null description to undefined in the returned task', async () => {
    await repo.create({ title: 'No description' });

    const [result] = await repo.findAll({ limit: 1000, offset: 0 });
    expect(result.description).toBeUndefined();
  });

  // I — Interface: every returned task reflects its DB row
  it('returns tasks whose ids match the rows stored in the database', async () => {
    await repo.create({ title: 'A' });
    await repo.create({ title: 'B' });

    const result = await repo.findAll({ limit: 1000, offset: 0 });
    const rows = await db.select().from(TABLE_TASKS);

    expect(result.map((t) => t.id).sort()).toEqual(
      rows.map((r) => r.id).sort(),
    );
  });

  // E — Exception: not applicable — findAll takes no input to be invalid.
});

describe('findAll with pagination', () => {
  it('returns an empty array when the table has no rows at all', async () => {
    const result = await repo.findAll({ limit: 20, offset: 0 });
    expect(result).toEqual([]);
  });

  it('returns only up to the given limit', async () => {
    await repo.create({ title: 'First' });
    await repo.create({ title: 'Second' });
    await repo.create({ title: 'Third' });

    const result = await repo.findAll({ limit: 2, offset: 0 });

    expect(result).toHaveLength(2);
  });

  it('skips the given offset before returning rows', async () => {
    await repo.create({ title: 'First' });
    await repo.create({ title: 'Second' });
    await repo.create({ title: 'Third' });

    const result = await repo.findAll({ limit: 20, offset: 1 });

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.title)).toEqual(['Second', 'Third']);
  });

  it('returns rows in a stable creation order across pages', async () => {
    await repo.create({ title: 'First' });
    await repo.create({ title: 'Second' });
    await repo.create({ title: 'Third' });

    const firstPage = await repo.findAll({ limit: 1, offset: 0 });
    const secondPage = await repo.findAll({ limit: 1, offset: 1 });
    const thirdPage = await repo.findAll({ limit: 1, offset: 2 });

    expect([
      firstPage[0].title,
      secondPage[0].title,
      thirdPage[0].title,
    ]).toEqual(['First', 'Second', 'Third']);
  });

  it('returns an empty array when the offset is beyond the number of rows', async () => {
    await repo.create({ title: 'Only task' });

    const result = await repo.findAll({ limit: 20, offset: 5 });

    expect(result).toEqual([]);
  });

  it('returns an empty array when the limit is zero', async () => {
    await repo.create({ title: 'First' });
    await repo.create({ title: 'Second' });

    const result = await repo.findAll({ limit: 0, offset: 0 });

    expect(result).toEqual([]);
  });

  it('returns every row when the limit is large enough to cover all rows', async () => {
    await repo.create({ title: 'First' });
    await repo.create({ title: 'Second' });

    const result = await repo.findAll({ limit: 1000, offset: 0 });

    expect(result).toHaveLength(2);
  });
});

describe('update', () => {
  // Z — Zero: nothing to update
  it('returns null when the table has no rows at all', async () => {
    const result = await repo.update(NON_EXISTENT_ID, { title: 'New title' });
    expect(result).toBeNull();
  });

  // O — One: a single field changes, others stay put
  it('updates only the given field and leaves the rest unchanged', async () => {
    const created = await repo.create({
      title: 'Original',
      description: 'Original description',
      status: TaskStatus.enum.OPEN,
    });

    const result = await repo.update(created.id, { title: 'Updated' });

    expect(result?.title).toBe('Updated');
    expect(result?.description).toBe('Original description');
    expect(result?.status).toBe(TaskStatus.enum.OPEN);
  });

  // M — Many: only the targeted row is affected
  it('does not modify other rows when updating one task', async () => {
    const first = await repo.create({ title: 'First' });
    const second = await repo.create({ title: 'Second' });

    await repo.update(first.id, { title: 'First updated' });

    const untouched = await repo.findById(second.id);
    expect(untouched?.title).toBe('Second');
  });

  // B — Boundary: an empty patch changes nothing
  it('leaves the task unchanged when given an empty patch', async () => {
    const created = await repo.create({
      title: 'Untouched',
      description: 'Stays the same',
    });

    const result = await repo.update(created.id, {});

    expect(result?.title).toBe('Untouched');
    expect(result?.description).toBe('Stays the same');
  });

  it('updates every field at once when all are provided', async () => {
    const created = await repo.create({ title: 'Original' });

    const result = await repo.update(created.id, {
      title: 'Fully updated',
      description: 'New description',
      status: TaskStatus.enum.DONE,
    });

    expect(result?.title).toBe('Fully updated');
    expect(result?.description).toBe('New description');
    expect(result?.status).toBe(TaskStatus.enum.DONE);
  });

  // I — Interface: the returned task matches the row actually persisted
  it('returns a task whose fields match the row in the database', async () => {
    const created = await repo.create({ title: 'Before' });

    const updated = await repo.update(created.id, { title: 'After' });

    const [row] = await db
      .select()
      .from(TABLE_TASKS)
      .where(eq(TABLE_TASKS.id, created.id));
    expect(updated?.title).toBe(row.title);
  });

  // E — Exception: DB-level constraint violations when bypassing TypeScript
  it('throws when updating status to an invalid enum value', async () => {
    const created = await repo.create({ title: 'Valid task' });

    await expect(
      repo.update(created.id, {
        status: 'INVALID_STATUS' as unknown as TaskStatus,
      }),
    ).rejects.toThrow();
  });

  it('throws when updating title to null (NOT NULL constraint)', async () => {
    const created = await repo.create({ title: 'Valid task' });

    await expect(
      repo.update(created.id, { title: null as unknown as string }),
    ).rejects.toThrow();
  });

  it('throws when the id is not a valid uuid', async () => {
    await expect(
      repo.update(MALFORMED_ID, { title: 'Anything' }),
    ).rejects.toThrow();
  });
});

describe('delete', () => {
  // Z — Zero: nothing to delete
  it('returns false when the table has no rows at all', async () => {
    const result = await repo.delete(NON_EXISTENT_ID);
    expect(result).toBe(false);
  });

  // O — One: the single existing row is removed
  it('removes the row and returns true', async () => {
    const created = await repo.create({ title: 'Delete me' });

    const result = await repo.delete(created.id);

    expect(result).toBe(true);
    const rows = await db.select().from(TABLE_TASKS);
    expect(rows).toHaveLength(0);
  });

  // M — Many: only the targeted row is removed
  it('removes only the targeted row, leaving the others intact', async () => {
    const first = await repo.create({ title: 'First' });
    const second = await repo.create({ title: 'Second' });

    await repo.delete(first.id);

    const rows = await db.select().from(TABLE_TASKS);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(second.id);
  });

  // B — Boundary: deleting the same id twice
  it('returns false the second time the same id is deleted', async () => {
    const created = await repo.create({ title: 'Once only' });

    await repo.delete(created.id);
    const secondAttempt = await repo.delete(created.id);

    expect(secondAttempt).toBe(false);
  });

  // I — Interface: repository view matches actual DB state after delete
  it('leaves findById unable to find the task after deletion', async () => {
    const created = await repo.create({ title: 'Gone soon' });

    await repo.delete(created.id);

    const result = await repo.findById(created.id);
    expect(result).toBeNull();
  });

  // E — Exception: malformed id is rejected at the DB level
  it('throws when the id is not a valid uuid', async () => {
    await expect(repo.delete(MALFORMED_ID)).rejects.toThrow();
  });
});
