import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from '@src/users/users.service';
import { User } from '@src/users/user.schema';
import { AuthService } from '@src/auth/auth.service';
import { LoginDto, RegisterDto } from '@src/auth/auth.schema';

const mockUsersService = {
  create: vi.fn(),
  findByEmailWithPassword: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn(),
};

const makeUserWithHashedPassword = async (
  plainPassword: string,
  overrides: Partial<User> = {},
): Promise<User> => ({
  id: randomUUID(),
  name: 'Test user',
  email: 'test.user@example.com',
  password: await bcrypt.hash(plainPassword, 10),
  createdAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'strongPassword',
    };

    it('delegates to usersService.create with the given register dto and returns its result', async () => {
      const createdUser = {
        id: 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5',
        name: registerDto.name,
        email: registerDto.email,
        createdAt: new Date(),
      };
      mockUsersService.create.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(mockUsersService.create).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(createdUser);
    });

    it('propagates a ConflictException thrown by usersService.create unchanged', async () => {
      const conflictError = new ConflictException(
        `A user with email ${registerDto.email} is already registered`,
      );
      mockUsersService.create.mockRejectedValue(conflictError);

      await expect(service.register(registerDto)).rejects.toBe(conflictError);
    });

    it('propagates an unrelated error from usersService.create unchanged', async () => {
      const unrelatedError = new Error('connection reset');
      mockUsersService.create.mockRejectedValue(unrelatedError);

      await expect(service.register(registerDto)).rejects.toBe(unrelatedError);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'ada@example.com',
      password: 'strongPassword',
    };

    it('returns a signed access token when email and password match a registered user', async () => {
      const user = await makeUserWithHashedPassword(loginDto.password, {
        email: loginDto.email,
      });
      mockUsersService.findByEmailWithPassword.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('signed.jwt.token');

      const result = await service.login(loginDto);

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    });

    it("signs the JWT with the user's id as sub and their email as payload", async () => {
      const user = await makeUserWithHashedPassword(loginDto.password, {
        email: loginDto.email,
      });
      mockUsersService.findByEmailWithPassword.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('signed.jwt.token');

      await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
    });

    it("throws Unauthorized with a generic 'invalid credentials' message when no user matches the given email", async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        /invalid credentials/i,
      );
    });

    it('throws the same generic Unauthorized error when the password does not match', async () => {
      const user = await makeUserWithHashedPassword(
        'aCompletelyDifferentPassword',
        {
          email: loginDto.email,
        },
      );
      mockUsersService.findByEmailWithPassword.mockResolvedValue(user);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        /invalid credentials/i,
      );
    });

    it("never includes the user's password or hash in the returned result", async () => {
      const user = await makeUserWithHashedPassword(loginDto.password, {
        email: loginDto.email,
      });
      mockUsersService.findByEmailWithPassword.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('signed.jwt.token');

      const result = await service.login(loginDto);

      expect(result).not.toHaveProperty('password');
      expect(Object.keys(result)).toEqual(['accessToken']);
    });
  });
});
