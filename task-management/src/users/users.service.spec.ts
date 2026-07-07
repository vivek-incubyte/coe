import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateUserDto, User } from './user.schema';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: randomUUID(),
  name: 'Test user',
  email: 'test.user@example.com',
  createdAt: new Date(),
  ...overrides,
});

type MockUsersRepository = {
  create: ReturnType<typeof vi.fn>;
  findAll: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
};

const makeMockRepository = (): MockUsersRepository => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
});

describe('UsersService', () => {
  let repository: MockUsersRepository;
  let service: UsersService;

  beforeEach(() => {
    repository = makeMockRepository();
    service = new UsersService(repository as unknown as UsersRepository);
  });

  describe('create', () => {
    it('resolves with the user the repository returns, including its generated id and createdAt', async () => {
      const createdUser = makeUser();
      repository.create.mockResolvedValue(createdUser);

      const result = await service.create({
        name: createdUser.name,
        email: createdUser.email,
      });

      expect(result).toEqual(createdUser);
      expect(result.id).toBe(createdUser.id);
      expect(result.createdAt).toBe(createdUser.createdAt);
    });

    it('passes the createUserDto through to the repository unchanged', async () => {
      repository.create.mockResolvedValue(makeUser());
      const createUserDto: CreateUserDto = {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
      };

      await service.create(createUserDto);

      expect(repository.create).toHaveBeenCalledWith(createUserDto);
    });

    it('throws ConflictException mentioning the email when the repository rejects with a unique-violation error', async () => {
      repository.create.mockRejectedValue({ code: '23505' });

      await expect(
        service.create({ name: 'Jane Doe', email: 'jane.doe@example.com' }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create({ name: 'Jane Doe', email: 'jane.doe@example.com' }),
      ).rejects.toThrow(/already registered/i);
    });

    it('propagates an unrelated repository error unchanged instead of wrapping it', async () => {
      const dbError = new Error('connection reset');
      repository.create.mockRejectedValue(dbError);

      await expect(
        service.create({ name: 'Jane Doe', email: 'jane.doe@example.com' }),
      ).rejects.toBe(dbError);
    });
  });

  describe('findAll', () => {
    it('returns an empty array when the repository has no users', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('returns the single user the repository resolves', async () => {
      const user = makeUser();
      repository.findAll.mockResolvedValue([user]);

      const result = await service.findAll();

      expect(result).toEqual([user]);
    });

    it('returns every user the repository resolves, unchanged', async () => {
      const users = [makeUser(), makeUser(), makeUser()];
      repository.findAll.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
    });
  });

  describe('findById', () => {
    it('returns the user when the repository finds a match', async () => {
      const user = makeUser();
      repository.findById.mockResolvedValue(user);

      const result = await service.findById(user.id);

      expect(result).toEqual(user);
    });

    it('passes the given id through to the repository', async () => {
      const id = randomUUID();
      repository.findById.mockResolvedValue(makeUser({ id }));

      await service.findById(id);

      expect(repository.findById).toHaveBeenCalledWith(id);
    });

    it('returns null without throwing when the repository finds no match', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await service.findById(randomUUID());

      expect(result).toBeNull();
    });
  });
});
