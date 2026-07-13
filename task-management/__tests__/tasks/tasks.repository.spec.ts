import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '@src/infra/database/schema';
import { TABLE_TASKS, TABLE_USERS } from '@src/infra/database/schema';
import { TaskStatus } from '@src/tasks/task.schema';
import { TasksRepository } from '@src/tasks/tasks.repository';

const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';
const MALFORMED_ID = 'not-a-uuid';

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;
let repo: TasksRepository;

async function createTestUser(overrides: {
  name?: string;
  email: string;
  password?: string;
}) {
  const [row] = await db
    .insert(TABLE_USERS)
    .values({
      name: overrides.name ?? 'Test user',
      email: overrides.email,
      password: overrides.password ?? 'DummyPassword',
    })
    .returning();
  return row;
}

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  db = drizzle(sql, { schema });

  await migrate(db, { migrationsFolder: 'src/infra/database/migrations' });

  repo = new TasksRepository(db);
}, 30_000);

beforeEach(async () => {
  await db.delete(TABLE_TASKS);
  await db.delete(TABLE_USERS);
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

  it('persists null for userId when none is provided (unassigned)', async () => {
    const task = await repo.create({ title: 'Unassigned task' });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.userId).toBeNull();
    expect(task.userId).toBeNull();
  });

  it('persists a valid userId when provided, referencing an existing user', async () => {
    const user = await createTestUser({ email: 'owner@example.com' });

    const task = await repo.create({
      title: 'Assigned task',
      userId: user.id,
    });

    const [row] = await db.select().from(TABLE_TASKS);
    expect(row.userId).toBe(user.id);
    expect(task.userId).toBe(user.id);
  });

  it('throws when userId references a user that does not exist (FK violation)', async () => {
    await expect(
      repo.create({ title: 'Bad owner', userId: NON_EXISTENT_ID }),
    ).rejects.toThrow();
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

  it('returns a task with userId included in the round trip', async () => {
    const user = await createTestUser({ email: 'assignee@example.com' });
    const created = await repo.create({
      title: 'Assigned round trip',
      userId: user.id,
    });

    const result = await repo.findById(created.id);

    expect(result?.userId).toBe(user.id);
  });

  it('returns a task with userId null when created unassigned', async () => {
    const created = await repo.create({ title: 'Unassigned round trip' });

    const result = await repo.findById(created.id);

    expect(result?.userId).toBeNull();
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

describe('findAll with search', () => {
  it('matches tasks by a case-insensitive substring of the title', async () => {
    const task = await repo.create({ title: 'Fix urgent bug' });
    await repo.create({ title: 'Write documentation' });

    const result = await repo.findAll({
      search: 'URGENT',
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(task.title);
  });

  it('matches tasks by a case-insensitive substring of the description', async () => {
    await repo.create({
      title: 'Task one',
      description: 'Contains deployment instructions',
    });
    await repo.create({
      title: 'Task two',
      description: 'Unrelated content',
    });

    const result = await repo.findAll({
      search: 'PLOY',
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(1);
  });

  it('returns a task once when both title and description match, not duplicated', async () => {
    await repo.create({
      title: 'Deploy the service',
      description: 'Remember to deploy carefully',
    });
    await repo.create({ title: 'Write docs' });

    const result = await repo.findAll({
      search: 'deploy',
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(1);
  });

  it('returns all matching tasks', async () => {
    await repo.create({ title: 'Deploy API' });
    await repo.create({ title: 'Deploy Worker' });
    await repo.create({ title: 'Write docs' });

    const result = await repo.findAll({
      search: 'deploy',
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(2);
  });

  it('matches a task by title even when its description is null', async () => {
    const task = await repo.create({ title: 'No description here' });
    await repo.create({ title: 'Something else entirely' });

    const result = await repo.findAll({
      search: 'description',
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(task.id);
  });

  it('returns an empty array when no task matches the search term', async () => {
    await repo.create({ title: 'Fix urgent bug' });
    await repo.create({ title: 'Write documentation' });

    const result = await repo.findAll({
      search: 'nonexistentterm',
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual([]);
  });

  it('applies the search filter before pagination limit/offset', async () => {
    await repo.create({ title: 'Write documentation' });
    await repo.create({ title: 'Deploy service A' });
    await repo.create({ title: 'Deploy service B' });

    const result = await repo.findAll({
      search: 'Deploy',
      limit: 1,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Deploy service A');
  });

  it('returns every task when the search term is an empty string', async () => {
    await repo.create({ title: 'Fix urgent bug' });
    await repo.create({ title: 'Write documentation' });

    const result = await repo.findAll({ search: '', limit: 20, offset: 0 });

    expect(result).toHaveLength(2);
  });

  it('matches tasks using a single-character search term', async () => {
    const match = await repo.create({ title: 'Cat' });
    await repo.create({ title: 'Zebra' });

    const result = await repo.findAll({ search: 'c', limit: 20, offset: 0 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(match.id);
  });
});

describe('findAll with status filter', () => {
  it('returns an empty array when no task has the given status', async () => {
    await repo.create({ title: 'Open task', status: TaskStatus.enum.OPEN });

    const result = await repo.findAll({
      status: TaskStatus.enum.DONE,
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual([]);
  });

  it('returns the task matching the given status', async () => {
    const match = await repo.create({
      title: 'In progress task',
      status: TaskStatus.enum.IN_PROGRESS,
    });
    await repo.create({ title: 'Open task', status: TaskStatus.enum.OPEN });

    const result = await repo.findAll({
      status: TaskStatus.enum.IN_PROGRESS,
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(match.id);
  });

  it('returns every task matching the given status, not just the first', async () => {
    await repo.create({ title: 'Done A', status: TaskStatus.enum.DONE });
    await repo.create({ title: 'Done B', status: TaskStatus.enum.DONE });
    await repo.create({ title: 'Open C', status: TaskStatus.enum.OPEN });

    const result = await repo.findAll({
      status: TaskStatus.enum.DONE,
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.title).sort()).toEqual(['Done A', 'Done B']);
  });

  it('returns every task when status is not provided', async () => {
    await repo.create({ title: 'Open task', status: TaskStatus.enum.OPEN });
    await repo.create({ title: 'Done task', status: TaskStatus.enum.DONE });

    const result = await repo.findAll({ limit: 20, offset: 0 });

    expect(result).toHaveLength(2);
  });

  it('applies the status filter before pagination limit/offset', async () => {
    await repo.create({ title: 'Done A', status: TaskStatus.enum.DONE });
    await repo.create({ title: 'Done B', status: TaskStatus.enum.DONE });
    await repo.create({ title: 'Open C', status: TaskStatus.enum.OPEN });

    const result = await repo.findAll({
      status: TaskStatus.enum.DONE,
      limit: 1,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Done A');
  });
});

describe('findAll with status and search combined', () => {
  it('returns the task that matches both status and search', async () => {
    const match = await repo.create({
      title: 'Fix urgent bug',
      status: TaskStatus.enum.OPEN,
    });
    await repo.create({
      title: 'Fix urgent bug',
      status: TaskStatus.enum.DONE,
    });
    await repo.create({
      title: 'Write documentation',
      status: TaskStatus.enum.OPEN,
    });

    const result = await repo.findAll({
      search: 'urgent',
      status: TaskStatus.enum.OPEN,
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(match.id);
  });

  it('excludes a task that matches status but not search', async () => {
    await repo.create({
      title: 'Write documentation',
      status: TaskStatus.enum.OPEN,
    });

    const result = await repo.findAll({
      search: 'urgent',
      status: TaskStatus.enum.OPEN,
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual([]);
  });

  it('excludes a task that matches search but not status', async () => {
    await repo.create({
      title: 'Fix urgent bug',
      status: TaskStatus.enum.DONE,
    });

    const result = await repo.findAll({
      search: 'urgent',
      status: TaskStatus.enum.OPEN,
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual([]);
  });

  it('returns every task matching both filters, not just the first', async () => {
    await repo.create({
      title: 'Fix urgent bug in API',
      status: TaskStatus.enum.OPEN,
    });
    await repo.create({
      title: 'Fix urgent bug in worker',
      status: TaskStatus.enum.OPEN,
    });
    await repo.create({
      title: 'Fix urgent bug elsewhere',
      status: TaskStatus.enum.DONE,
    });

    const result = await repo.findAll({
      search: 'urgent',
      status: TaskStatus.enum.OPEN,
      limit: 20,
      offset: 0,
    });

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

  it("updates a task's userId to a new user", async () => {
    const created = await repo.create({ title: 'Unassigned' });
    const user = await createTestUser({ email: 'new-owner@example.com' });

    const result = await repo.update(created.id, { userId: user.id });

    expect(result?.userId).toBe(user.id);
  });

  it("updates a task's userId to null, unassigning it", async () => {
    const user = await createTestUser({ email: 'former-owner@example.com' });
    const created = await repo.create({
      title: 'Assigned',
      userId: user.id,
    });

    const result = await repo.update(created.id, { userId: null });

    expect(result?.userId).toBeNull();
  });

  it('throws when updating userId to a user that does not exist (FK violation)', async () => {
    const created = await repo.create({ title: 'Valid task' });

    await expect(
      repo.update(created.id, { userId: NON_EXISTENT_ID }),
    ).rejects.toThrow();
  });
});

describe('userId FK — cascade behavior on user deletion', () => {
  it('unassigns a task (sets userId to null) when the assigned user is deleted', async () => {
    const user = await createTestUser({ email: 'to-be-deleted@example.com' });
    const created = await repo.create({
      title: 'Assigned to a user who will be deleted',
      userId: user.id,
    });

    await db.delete(TABLE_USERS).where(eq(TABLE_USERS.id, user.id));

    const result = await repo.findById(created.id);
    expect(result?.userId).toBeNull();
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
