import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateUserDto, PublicUser, User } from '../../src/users/user.schema';
import {
  CreateUserInput,
  UsersRepository,
} from '../../src/users/users.repository';
import { UsersService } from '../../src/users/users.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: randomUUID(),
  name: 'Test user',
  email: 'test.user@example.com',
  password: 'DummyPassword',
  createdAt: new Date(),
  ...overrides,
});

type MockUsersRepository = {
  create: ReturnType<
    typeof vi.fn<(input: CreateUserInput) => Promise<PublicUser>>
  >;
  findAll: ReturnType<typeof vi.fn<() => Promise<PublicUser[]>>>;
  findById: ReturnType<
    typeof vi.fn<(id: string) => Promise<PublicUser | null>>
  >;
  findByEmailWithPassword: ReturnType<
    typeof vi.fn<(email: string) => Promise<User | null>>
  >;
};

const makeMockRepository = (): MockUsersRepository => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  findByEmailWithPassword: vi.fn(),
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
        password: createdUser.password,
      });

      expect(result).toEqual(createdUser);
      expect(result.id).toBe(createdUser.id);
      expect(result.createdAt).toBe(createdUser.createdAt);
    });

    it('passes the name and email unchanged but hashes the password before calling the repository', async () => {
      repository.create.mockResolvedValue(makeUser());
      const createUserDto: CreateUserDto = {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        password: 'DummyPassword',
      };

      await service.create(createUserDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: createUserDto.name,
          email: createUserDto.email,
        }),
      );
      const [passedArg] = repository.create.mock.calls[0];
      expect(passedArg.password).not.toBe(createUserDto.password);
    });

    it('stores a bcrypt hash that verifies against the original plaintext password', async () => {
      repository.create.mockResolvedValue(makeUser());
      const plainPassword = 'DummyPassword';

      await service.create({
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        password: plainPassword,
      });

      const [passedArg] = repository.create.mock.calls[0];
      const isMatch = await bcrypt.compare(plainPassword, passedArg.password);
      expect(isMatch).toBe(true);
    });

    it('hashes the same plaintext password differently across separate registrations', async () => {
      repository.create.mockResolvedValue(makeUser());
      const plainPassword = 'DummyPassword';

      await service.create({
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        password: plainPassword,
      });
      const [firstArg] = repository.create.mock.calls[0];

      await service.create({
        name: 'John Roe',
        email: 'john.roe@example.com',
        password: plainPassword,
      });
      const [secondArg] = repository.create.mock.calls[1];

      expect(firstArg.password).not.toBe(secondArg.password);
    });

    it('throws ConflictException mentioning the email when the repository rejects with a unique-violation error', async () => {
      repository.create.mockRejectedValue({ code: '23505' });

      await expect(
        service.create({
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          password: 'DummyPassword',
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create({
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          password: 'DummyPassword',
        }),
      ).rejects.toThrow(/already registered/i);
    });

    it('propagates an unrelated repository error unchanged instead of wrapping it', async () => {
      const dbError = new Error('connection reset');
      repository.create.mockRejectedValue(dbError);

      await expect(
        service.create({
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          password: 'DummyPassword',
        }),
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

  describe('findByEmailWithPassword', () => {
    it('returns the user the repository resolves, including the password', async () => {
      const user = makeUser();
      repository.findByEmailWithPassword.mockResolvedValue(user);

      const result = await service.findByEmailWithPassword(user.email);

      expect(result).toEqual(user);
    });

    it('passes the given email through to the repository', async () => {
      const email = 'jane.doe@example.com';
      repository.findByEmailWithPassword.mockResolvedValue(makeUser({ email }));

      await service.findByEmailWithPassword(email);

      expect(repository.findByEmailWithPassword).toHaveBeenCalledWith(email);
    });

    it('returns null without throwing when the repository finds no match', async () => {
      repository.findByEmailWithPassword.mockResolvedValue(null);

      const result = await service.findByEmailWithPassword(
        'missing@example.com',
      );

      expect(result).toBeNull();
    });
  });
});
