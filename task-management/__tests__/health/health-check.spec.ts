import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseHealthIndicator } from '@src/health/database.health-indicator';
import { HealthController } from '@src/health/health.controller';
import { DATABASE_CONNECTION } from '@src/infra/database/database.module';

const stubDatabase = {
  execute: vi.fn(),
};

describe('GET /health', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        DatabaseHealthIndicator,
        { provide: DATABASE_CONNECTION, useValue: stubDatabase },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with status "ok" when the database is reachable', async () => {
    stubDatabase.execute.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });
  });

  it('returns 503 with status "error" when the database check fails', async () => {
    stubDatabase.execute.mockRejectedValue(new Error('connection refused'));

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.body).toEqual({
      status: 'error',
      info: {},
      error: { database: { status: 'down' } },
      details: { database: { status: 'down' } },
    });
  });

  it('is reachable without an Authorization header', async () => {
    stubDatabase.execute.mockResolvedValue(undefined);

    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('does not reject a bogus Authorization header, confirming no auth guard is applied', async () => {
    stubDatabase.execute.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .get('/health')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(200);
  });
});
