import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../src/infra/database/schema';
import { TABLE_USERS } from '../../src/infra/database/schema';
import { UsersRepository } from '../../src/users/users.repository';

const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';
const MALFORMED_ID = 'not-a-uuid';

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;
let repo: UsersRepository;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set in .env');

  sql = postgres(url, { max: 1 });
  db = drizzle(sql, { schema });

  await migrate(db, { migrationsFolder: 'src/infra/database/migrations' });

  repo = new UsersRepository(db);
}, 30_000);

beforeEach(async () => {
  await db.delete(TABLE_USERS);
});

afterAll(async () => {
  await sql.end();
});

describe('create', () => {
  it('inserts exactly one row in the database', async () => {
    await repo.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'DummyPassword',
    });

    const rows = await db.select().from(TABLE_USERS);
    expect(rows).toHaveLength(1);
  });

  it('persists the name to the database', async () => {
    await repo.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'DummyPassword',
    });

    const [row] = await db.select().from(TABLE_USERS);
    expect(row.name).toBe('Ada Lovelace');
  });

  it('persists the email to the database', async () => {
    await repo.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'DummyPassword',
    });

    const [row] = await db.select().from(TABLE_USERS);
    expect(row.email).toBe('ada@example.com');
  });

  it('each create call inserts a separate row with a unique id', async () => {
    await repo.create({
      name: 'First',
      email: 'first@example.com',
      password: 'DummyPassword',
    });
    await repo.create({
      name: 'Second',
      email: 'second@example.com',
      password: 'DummyPassword',
    });

    const rows = await db.select().from(TABLE_USERS);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it('persists a single-character name without truncation', async () => {
    await repo.create({
      name: 'X',
      email: 'x@example.com',
      password: 'DummyPassword',
    });

    const [row] = await db.select().from(TABLE_USERS);
    expect(row.name).toBe('X');
  });

  it('returns a user whose id matches the row stored in the database', async () => {
    const user = await repo.create({
      name: 'ID check',
      email: 'idcheck@example.com',
      password: 'DummyPassword',
    });

    const [row] = await db
      .select()
      .from(TABLE_USERS)
      .where(eq(TABLE_USERS.id, user.id));
    expect(row).toBeDefined();
  });

  it('returns a user whose fields match the persisted row', async () => {
    const user = await repo.create({
      name: 'Round Trip',
      email: 'roundtrip@example.com',
      password: 'DummyPassword',
    });

    const [row] = await db
      .select()
      .from(TABLE_USERS)
      .where(eq(TABLE_USERS.id, user.id));
    expect(user.name).toBe(row.name);
    expect(user.email).toBe(row.email);
  });

  it('returns a user with a createdAt timestamp', async () => {
    const user = await repo.create({
      name: 'Timestamped',
      email: 'timestamped@example.com',
      password: 'DummyPassword',
    });

    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('throws when name is null (NOT NULL constraint)', async () => {
    await expect(
      repo.create({
        name: null as unknown as string,
        email: 'noname@example.com',
        password: 'DummyPassword',
      }),
    ).rejects.toThrow();
  });

  it('does not insert any row when name is null', async () => {
    await repo
      .create({
        name: null as unknown as string,
        email: 'noname@example.com',
        password: 'DummyPassword',
      })
      .catch(() => {});

    const rows = await db.select().from(TABLE_USERS);
    expect(rows).toHaveLength(0);
  });

  it('throws when email is null (NOT NULL constraint)', async () => {
    await expect(
      repo.create({
        name: 'No Email',
        email: null as unknown as string,
        password: 'DummyPassword',
      }),
    ).rejects.toThrow();
  });

  it('does not insert any row when email is null', async () => {
    await repo
      .create({
        name: 'No Email',
        email: null as unknown as string,
        password: 'DummyPassword',
      })
      .catch(() => {});

    const rows = await db.select().from(TABLE_USERS);
    expect(rows).toHaveLength(0);
  });

  it('throws when creating a second user with the exact same email', async () => {
    await repo.create({
      name: 'First',
      email: 'duplicate@example.com',
      password: 'DummyPassword',
    });

    await expect(
      repo.create({
        name: 'Second',
        email: 'duplicate@example.com',
        password: 'DummyPassword',
      }),
    ).rejects.toThrow();
  });

  it('throws when creating a second user with the same email in a different case', async () => {
    await repo.create({
      name: 'First',
      email: 'Foo@x.com',
      password: 'DummyPassword',
    });

    await expect(
      repo.create({
        name: 'Second',
        email: 'foo@x.com',
        password: 'DummyPassword',
      }),
    ).rejects.toThrow();
  });

  it('does not insert a second row when the duplicate email differs only in case', async () => {
    await repo.create({
      name: 'First',
      email: 'Foo@x.com',
      password: 'DummyPassword',
    });
    await repo
      .create({
        name: 'Second',
        email: 'foo@x.com',
        password: 'DummyPassword',
      })
      .catch(() => {});

    const rows = await db.select().from(TABLE_USERS);
    expect(rows).toHaveLength(1);
  });

  it('allows two different users with entirely different emails', async () => {
    await repo.create({
      name: 'First',
      email: 'first@example.com',
      password: 'DummyPassword',
    });
    await repo.create({
      name: 'Second',
      email: 'second@example.com',
      password: 'DummyPassword',
    });

    const rows = await db.select().from(TABLE_USERS);
    expect(rows).toHaveLength(2);
  });
});

describe('findById', () => {
  it('returns null when the table has no rows at all', async () => {
    const result = await repo.findById(NON_EXISTENT_ID);
    expect(result).toBeNull();
  });

  it('returns the user when exactly one row exists and matches the id', async () => {
    const created = await repo.create({
      name: 'Find me',
      email: 'findme@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findById(created.id);
    expect(result?.id).toBe(created.id);
  });

  it('returns the correct user when multiple rows exist', async () => {
    await repo.create({
      name: 'First',
      email: 'first@example.com',
      password: 'DummyPassword',
    });
    const target = await repo.create({
      name: 'Target',
      email: 'target@example.com',
      password: 'DummyPassword',
    });
    await repo.create({
      name: 'Third',
      email: 'third@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findById(target.id);
    expect(result?.name).toBe('Target');
  });

  it('returns null for a well-formed uuid that does not exist', async () => {
    await repo.create({
      name: 'Some user',
      email: 'someuser@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findById(NON_EXISTENT_ID);
    expect(result).toBeNull();
  });

  it('returns a user with all fields matching the persisted row', async () => {
    const created = await repo.create({
      name: 'Full round trip',
      email: 'fullroundtrip@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findById(created.id);

    expect(result).toEqual(created);
  });

  it('throws when the id is not a valid uuid', async () => {
    await expect(repo.findById(MALFORMED_ID)).rejects.toThrow();
  });
});

describe('findAll', () => {
  it('returns an empty array when there are no users', async () => {
    const result = await repo.findAll();
    expect(result).toEqual([]);
  });

  it('returns a single-element array when one user exists', async () => {
    await repo.create({
      name: 'Only user',
      email: 'only@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findAll();
    expect(result).toHaveLength(1);
  });

  it('returns every user when multiple exist', async () => {
    await repo.create({
      name: 'First',
      email: 'first@example.com',
      password: 'DummyPassword',
    });
    await repo.create({
      name: 'Second',
      email: 'second@example.com',
      password: 'DummyPassword',
    });
    await repo.create({
      name: 'Third',
      email: 'third@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findAll();

    expect(result).toHaveLength(3);
    expect(result.map((u) => u.name).sort()).toEqual(
      ['First', 'Second', 'Third'].sort(),
    );
  });

  it('returns users whose ids match the rows stored in the database', async () => {
    await repo.create({
      name: 'A',
      email: 'a@example.com',
      password: 'DummyPassword',
    });
    await repo.create({
      name: 'B',
      email: 'b@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findAll();
    const rows = await db.select().from(TABLE_USERS);

    expect(result.map((u) => u.id).sort()).toEqual(
      rows.map((r) => r.id).sort(),
    );
  });

  it('includes a newly created user in the list of all users', async () => {
    await repo.create({
      name: 'Existing',
      email: 'existing@example.com',
      password: 'DummyPassword',
    });

    const created = await repo.create({
      name: 'Newcomer',
      email: 'newcomer@example.com',
      password: 'DummyPassword',
    });
    const result = await repo.findAll();

    expect(result.some((u) => u.id === created.id)).toBe(true);
  });
});

describe('findByEmailWithPassword', () => {
  it('returns null when no user exists with that email', async () => {
    const result = await repo.findByEmailWithPassword('missing@example.com');
    expect(result).toBeNull();
  });

  it('returns the full user including the password field when exactly one match exists', async () => {
    await repo.create({
      name: 'Login Candidate',
      email: 'logincandidate@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findByEmailWithPassword(
      'logincandidate@example.com',
    );

    expect(result?.email).toBe('logincandidate@example.com');
    expect(result?.password).toBe('DummyPassword');
  });

  it('finds a user by email regardless of case', async () => {
    await repo.create({
      name: 'Case Insensitive',
      email: 'Foo@x.com',
      password: 'DummyPassword',
    });

    const result = await repo.findByEmailWithPassword('foo@x.com');

    expect(result?.email).toBe('Foo@x.com');
  });

  it('returns the correct user when multiple users exist', async () => {
    await repo.create({
      name: 'First',
      email: 'first@example.com',
      password: 'FirstPassword',
    });
    const target = await repo.create({
      name: 'Target',
      email: 'target@example.com',
      password: 'TargetPassword',
    });
    await repo.create({
      name: 'Third',
      email: 'third@example.com',
      password: 'ThirdPassword',
    });

    const result = await repo.findByEmailWithPassword('target@example.com');

    expect(result?.id).toBe(target.id);
    expect(result?.password).toBe('TargetPassword');
  });

  it('returns a password field that is a non-empty string, unlike findById', async () => {
    await repo.create({
      name: 'Password Sanity Check',
      email: 'passwordsanity@example.com',
      password: 'DummyPassword',
    });

    const result = await repo.findByEmailWithPassword(
      'passwordsanity@example.com',
    );

    expect(typeof result?.password).toBe('string');
    expect(result?.password.length).toBeGreaterThan(0);
  });
});
