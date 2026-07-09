import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicUser } from '../../src/users/user.schema';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { LoginDto, RegisterDto } from '../../src/auth/auth.schema';

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

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'strongPassword',
    };

    it("returns the created user's public fields with createdAt as an ISO string, never the password", async () => {
      mockAuthService.register.mockResolvedValue(makePublicUser());

      const dto = await controller.register(registerDto);

      expect(dto.id).toBe('a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5');
      expect(dto.name).toBe('Ada Lovelace');
      expect(dto.email).toBe('ada@example.com');
      expect(dto.createdAt).toBe('2024-06-15T12:00:00.000Z');
      expect(dto).not.toHaveProperty('password');
    });

    it('delegates the register dto to authService.register unchanged', async () => {
      mockAuthService.register.mockResolvedValue(makePublicUser());

      await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });

    it('propagates a ConflictException thrown by authService.register', async () => {
      const conflictError = new ConflictException(
        `A user with email ${registerDto.email} is already registered`,
      );
      mockAuthService.register.mockRejectedValue(conflictError);

      await expect(controller.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'ada@example.com',
      password: 'strongPassword',
    };

    it('returns the access token when authService.login resolves', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'signed.jwt.token',
      });

      const result = await controller.login(loginDto);

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    });

    it('delegates the login dto to authService.login unchanged', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'signed.jwt.token',
      });

      await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });

    it('propagates an UnauthorizedException thrown by authService.login', async () => {
      const unauthorizedError = new UnauthorizedException(
        'Invalid credentials',
      );
      mockAuthService.login.mockRejectedValue(unauthorizedError);

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
