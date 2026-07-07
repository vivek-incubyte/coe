import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateUserDto, User, UserResponseDto } from './user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: randomUUID(),
  name: 'Test user',
  email: 'test.user@example.com',
  createdAt: new Date(),
  ...overrides,
});

const mockUsersService = {
  create: vi.fn(),
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

  describe('create', () => {
    it('passes the createUserDto through to the service unchanged', async () => {
      mockUsersService.create.mockResolvedValue(makeUser());
      const createUserDto: CreateUserDto = {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      };

      await controller.create(createUserDto);

      expect(mockUsersService.create).toHaveBeenCalledWith(createUserDto);
    });

    it('returns the mapped response dto with the id, name, and email the service returns', async () => {
      const createdUser = makeUser({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      });
      mockUsersService.create.mockResolvedValue(createdUser);

      const dto = await controller.create({
        name: createdUser.name,
        email: createdUser.email,
      });

      expect(dto.id).toBe(createdUser.id);
      expect(dto.name).toBe(createdUser.name);
      expect(dto.email).toBe(createdUser.email);
    });

    it('converts createdAt to an ISO string in the response', async () => {
      const fixedDate = new Date('2024-06-15T12:00:00.000Z');
      const createdUser = makeUser({ createdAt: fixedDate });
      mockUsersService.create.mockResolvedValue(createdUser);

      const dto = await controller.create({
        name: createdUser.name,
        email: createdUser.email,
      });

      expect(dto.createdAt).toBe('2024-06-15T12:00:00.000Z');
    });

    it('propagates the ConflictException the service throws', async () => {
      mockUsersService.create.mockRejectedValue(
        new ConflictException('A user with this email is already registered'),
      );

      await expect(
        controller.create({ name: 'Dup user', email: 'dup@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
