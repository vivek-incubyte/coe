import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { PublicUser } from '@src/users/user.schema';
import { AuthController } from '@src/auth/auth.controller';
import { AuthService } from '@src/auth/auth.service';

const makePublicUser = (overrides: Partial<PublicUser> = {}): PublicUser => ({
  id: 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  createdAt: new Date('2024-06-15T12:00:00.000Z'),
  ...overrides,
});

const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
};

describe('AuthController (HTTP)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('responds with 201 when registration succeeds', async () => {
      mockAuthService.register.mockResolvedValue(makePublicUser());

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          password: 'strongPassword',
        })
        .expect(201);
    });
  });

  describe('POST /auth/login', () => {
    it('responds with 200 when login succeeds', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'signed.jwt.token',
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'strongPassword' })
        .expect(200);
    });

    it('responds with 401 when authService.login rejects with UnauthorizedException', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'wrongPassword' })
        .expect(401);
    });
  });
});
