import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { User, UserResponseDto } from '../../src/users/user.schema';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: randomUUID(),
  name: 'Test user',
  email: 'test.user@example.com',
  createdAt: new Date(),
  password: 'DummyPassword',
  ...overrides,
});

const mockUsersService = {
  findAll: vi.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('findAll', () => {
    it('returns an empty array when the service has no users', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    it('returns a bare array, not wrapped in an envelope', async () => {
      mockUsersService.findAll.mockResolvedValue([makeUser()]);

      const result = await controller.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).not.toHaveProperty('items');
      expect(result).not.toHaveProperty('total');
    });

    it('maps a user to a response dto, converting createdAt to an ISO string', async () => {
      const fixedDate = new Date('2024-06-15T12:00:00.000Z');
      const user = makeUser({ createdAt: fixedDate });
      mockUsersService.findAll.mockResolvedValue([user]);

      const [dto] = await controller.findAll();

      expect(dto.createdAt).toBe('2024-06-15T12:00:00.000Z');
      expect(dto.id).toBe(user.id);
      expect(dto.name).toBe(user.name);
      expect(dto.email).toBe(user.email);
    });

    it('applies the createdAt conversion to every user returned', async () => {
      const users = [
        makeUser({ createdAt: new Date('2024-01-01T00:00:00.000Z') }),
        makeUser({ createdAt: new Date('2024-02-01T00:00:00.000Z') }),
      ];
      mockUsersService.findAll.mockResolvedValue(users);

      const result: UserResponseDto[] = await controller.findAll();

      expect(result[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result[1].createdAt).toBe('2024-02-01T00:00:00.000Z');
    });
  });
});

describe('UsersController (HTTP)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds 404 for POST /users since user creation moved to /auth/register', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Ada Lovelace', email: 'ada@example.com' })
      .expect(404);
  });
});
