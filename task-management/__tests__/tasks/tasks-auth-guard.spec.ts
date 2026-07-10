import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '@src/app.module';
import * as schema from '@src/infra/database/schema';
import { TABLE_TASKS, TABLE_USERS } from '@src/infra/database/schema';

interface AuthResponseBody {
  accessToken: string;
}

interface ResourceResponseBody {
  id: string;
}

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;
let app: INestApplication<App>;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set in .env');

  // Point the app's own DatabaseModule (ConfigService.getOrThrow('DATABASE_URL'))
  // at the test database before the Nest module tree is compiled.
  process.env.DATABASE_URL = url;

  sql = postgres(url, { max: 1 });
  db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: 'src/infra/database/migrations' });

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  await app.init();
}, 30_000);

beforeEach(async () => {
  await db.delete(TABLE_TASKS);
  await db.delete(TABLE_USERS);
});

afterAll(async () => {
  await app.close();
  await sql.end();
});

const registerAndLogin = async (): Promise<string> => {
  const email = `user-${randomUUID()}@example.com`;
  const password = 'strongPassword';

  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ name: 'Ada Lovelace', email, password })
    .expect(201);

  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  return (loginResponse.body as AuthResponseBody).accessToken;
};

describe('task endpoints without a token', () => {
  it('GET /tasks returns 401', async () => {
    await request(app.getHttpServer()).get('/tasks').expect(401);
  });

  it('GET /tasks/:id returns 401', async () => {
    await request(app.getHttpServer())
      .get(`/tasks/${randomUUID()}`)
      .expect(401);
  });

  it('POST /tasks returns 401', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'Unauthorized task' })
      .expect(401);
  });

  it('PATCH /tasks/:id returns 401', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${randomUUID()}`)
      .send({ title: 'Unauthorized update' })
      .expect(401);
  });

  it('DELETE /tasks/:id returns 401', async () => {
    await request(app.getHttpServer())
      .delete(`/tasks/${randomUUID()}`)
      .expect(401);
  });
});

describe('task endpoints with a bad token', () => {
  it('returns 401 when the Authorization header has an invalid/garbage token', async () => {
    await request(app.getHttpServer())
      .get('/tasks')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('returns 401 for GET /tasks/:id when the Authorization header has an invalid/garbage token', async () => {
    await request(app.getHttpServer())
      .get(`/tasks/${randomUUID()}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('returns 401 for POST /tasks when the Authorization header has an invalid/garbage token', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ title: 'Ship the feature' })
      .expect(401);
  });

  it('returns 401 for PATCH /tasks/:id when the Authorization header has an invalid/garbage token', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${randomUUID()}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ title: 'Ship the feature' })
      .expect(401);
  });

  it('returns 401 for DELETE /tasks/:id when the Authorization header has an invalid/garbage token', async () => {
    await request(app.getHttpServer())
      .delete(`/tasks/${randomUUID()}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('returns 401 when the token is well-formed but signed for a user that no longer exists', async () => {
    const email = `orphan-${randomUUID()}@example.com`;
    const password = 'strongPassword';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Orphaned User', email, password })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const accessToken = (loginResponse.body as AuthResponseBody).accessToken;

    await db
      .delete(TABLE_USERS)
      .where(
        eq(TABLE_USERS.id, (registerResponse.body as ResourceResponseBody).id),
      );

    await request(app.getHttpServer())
      .get('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('returns 401 for GET /tasks/:id when the token is well-formed but signed for a user that no longer exists', async () => {
    const email = `orphan-${randomUUID()}@example.com`;
    const password = 'strongPassword';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Orphaned User', email, password })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const accessToken = (loginResponse.body as AuthResponseBody).accessToken;

    await db
      .delete(TABLE_USERS)
      .where(
        eq(TABLE_USERS.id, (registerResponse.body as ResourceResponseBody).id),
      );

    await request(app.getHttpServer())
      .get(`/tasks/${randomUUID()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('returns 401 for POST /tasks when the token is well-formed but signed for a user that no longer exists', async () => {
    const email = `orphan-${randomUUID()}@example.com`;
    const password = 'strongPassword';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Orphaned User', email, password })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const accessToken = (loginResponse.body as AuthResponseBody).accessToken;

    await db
      .delete(TABLE_USERS)
      .where(
        eq(TABLE_USERS.id, (registerResponse.body as ResourceResponseBody).id),
      );

    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Ship the feature' })
      .expect(401);
  });

  it('returns 401 for PATCH /tasks/:id when the token is well-formed but signed for a user that no longer exists', async () => {
    const email = `orphan-${randomUUID()}@example.com`;
    const password = 'strongPassword';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Orphaned User', email, password })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const accessToken = (loginResponse.body as AuthResponseBody).accessToken;

    await db
      .delete(TABLE_USERS)
      .where(
        eq(TABLE_USERS.id, (registerResponse.body as ResourceResponseBody).id),
      );

    await request(app.getHttpServer())
      .patch(`/tasks/${randomUUID()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Ship the feature' })
      .expect(401);
  });

  it('returns 401 for DELETE /tasks/:id when the token is well-formed but signed for a user that no longer exists', async () => {
    const email = `orphan-${randomUUID()}@example.com`;
    const password = 'strongPassword';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Orphaned User', email, password })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const accessToken = (loginResponse.body as AuthResponseBody).accessToken;

    await db
      .delete(TABLE_USERS)
      .where(
        eq(TABLE_USERS.id, (registerResponse.body as ResourceResponseBody).id),
      );

    await request(app.getHttpServer())
      .delete(`/tasks/${randomUUID()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});

describe('task endpoints with a valid token', () => {
  it('returns 200 and the normal task list shape when called with a valid, current access token', async () => {
    const accessToken = await registerAndLogin();

    const response = await request(app.getHttpServer())
      .get('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('allows a full register -> login -> create a task flow using the issued access token', async () => {
    const accessToken = await registerAndLogin();

    const response = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Ship the feature' })
      .expect(201);

    expect(response.body).toMatchObject({ title: 'Ship the feature' });
    expect((response.body as ResourceResponseBody).id).toBeDefined();
  });

  it('returns 200 and the created task when GET /tasks/:id is called with a valid, current access token', async () => {
    const accessToken = await registerAndLogin();

    const createResponse = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Ship the feature' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/tasks/${(createResponse.body as ResourceResponseBody).id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: (createResponse.body as ResourceResponseBody).id,
      title: 'Ship the feature',
      status: 'OPEN',
    });
  });

  it('returns 200 and the updated task when PATCH /tasks/:id is called with a valid, current access token', async () => {
    const accessToken = await registerAndLogin();

    const createResponse = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Ship the feature' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/tasks/${(createResponse.body as ResourceResponseBody).id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Ship the feature, revised' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: (createResponse.body as ResourceResponseBody).id,
      title: 'Ship the feature, revised',
    });
  });

  it('returns 204 and deletes the task when DELETE /tasks/:id is called with a valid, current access token', async () => {
    const accessToken = await registerAndLogin();

    const createResponse = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Ship the feature' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/tasks/${(createResponse.body as ResourceResponseBody).id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/tasks/${(createResponse.body as ResourceResponseBody).id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});

describe('users endpoint unaffected by task guarding', () => {
  it('GET /users still works without a token', async () => {
    await request(app.getHttpServer()).get('/users').expect(200);
  });
});
