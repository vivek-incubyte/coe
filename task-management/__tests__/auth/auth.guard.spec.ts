import { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '@src/auth/auth.guard';
import { UsersService } from '@src/users/users.service';

const mockJwtService = {
  verifyAsync: vi.fn(),
};

const mockUsersService = {
  findById: vi.fn(),
};

const makeExecutionContext = (
  headers: Record<string, string>,
): ExecutionContext => {
  const request = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
};

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  describe('canActivate', () => {
    it('denies the request when the Authorization header is missing', async () => {
      const context = makeExecutionContext({});
      const result = await guard.canActivate(context);
      expect(result).toBe(false);
    });

    it('denies the request when the header does not start with "Bearer "', async () => {
      const context = makeExecutionContext({
        authorization: `No Bearer`,
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('denies the request when the decoded token is falsy', async () => {
      mockJwtService.verifyAsync.mockResolvedValue(null);

      const context = makeExecutionContext({
        authorization: `Bearer TempToken`,
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockUsersService.findById).not.toHaveBeenCalled();
    });

    it('denies the request when jwtService.verifyAsync rejects', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid Token'));

      const context = makeExecutionContext({
        authorization: `Bearer TempToken`,
      });
      const result = await guard.canActivate(context);
      expect(mockJwtService.verifyAsync).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('denies the request when user not found', async () => {
      const validUserId = 'bcee941d-d946-46d7-9b7f-07fab2c12873';
      //  1: Mock JWT Service
      const payload = { sub: validUserId, email: 'test@test.com' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      //  2: Mock User Service
      mockUsersService.findById.mockResolvedValue(null);

      const validAuthToken = 'ValidAuthToken';
      const context = makeExecutionContext({
        authorization: `Bearer ${validAuthToken}`,
      });
      const result = await guard.canActivate(context);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(validAuthToken);
      expect(mockUsersService.findById).toHaveBeenCalledWith(validUserId);
      expect(result).toBe(false);
    });

    it('denies the request when userService rejects', async () => {
      const validUserId = 'bcee941d-d946-46d7-9b7f-07fab2c12873';
      //  1: Mock JWT Service
      const payload = { sub: validUserId, email: 'test@test.com' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      //  2: Mock User Service
      mockUsersService.findById.mockRejectedValue(
        new Error('Database not working'),
      );

      const context = makeExecutionContext({
        authorization: `Bearer TempToken`,
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Database not working',
      );
    });

    it('attaches the fetched user to the request as request.user', async () => {
      const validUserId = 'bcee941d-d946-46d7-9b7f-07fab2c12873';
      //  1: Mock JWT Service
      const payload = { sub: validUserId, email: 'test@test.com' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      //  2: Mock User Service
      const user = {
        id: validUserId,
        name: 'Ada',
        email: 'test@test.com',
        createdAt: new Date(),
      };
      mockUsersService.findById.mockResolvedValue(user);

      const validAuthToken = 'ValidAuthToken';
      const context = makeExecutionContext({
        authorization: `Bearer ${validAuthToken}`,
      });
      const request = context.switchToHttp().getRequest<Request>();
      const result = await guard.canActivate(context);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(validAuthToken);
      expect(mockUsersService.findById).toHaveBeenCalledWith(validUserId);
      expect(result).toBe(true);
      expect(request.user).toEqual(user);
    });

    it('allows the request through when the token is valid', async () => {
      const validUserId = 'bcee941d-d946-46d7-9b7f-07fab2c12873';
      //  1: Mock JWT Service
      const payload = { sub: validUserId, email: 'test@test.com' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      //  2: Mock User Service
      const user = {
        id: validUserId,
        name: 'Ada',
        email: 'test@test.com',
        createdAt: new Date(),
      };
      mockUsersService.findById.mockResolvedValue(user);

      const validAuthToken = '435701c2-4d21-4a1a-a3d4-1f707055a33f';
      const context = makeExecutionContext({
        authorization: `Bearer ${validAuthToken}`,
      });
      const result = await guard.canActivate(context);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(validAuthToken);
      expect(mockUsersService.findById).toHaveBeenCalledWith(validUserId);
      expect(result).toBe(true);
    });
  });
});
